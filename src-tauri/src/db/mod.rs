mod annotations;
pub mod collection;
mod legacy;
mod legacy_encoding;
mod models;
mod pgn;
mod search;

use crate::{db::models::*, error::Error, AppState};
use aix_chess_compression::CompressionLevel as AixCompressionLevel;
use dashmap::mapref::entry::Entry;
use duckdb::{params, AccessMode, Config, Connection, DuckdbConnectionManager};
use r2d2::CustomizeConnection;
use r2d2::Pool;

use serde::{Deserialize, Serialize};
use shakmaty::fen::Fen;
use specta::Type;
use std::collections::HashMap;
use std::io::{BufWriter, Write};
use std::sync::{Arc, Mutex};
use std::{
    fs::{remove_file, File, OpenOptions},
    path::{Path, PathBuf},
    time::Instant,
};
use tauri::Emitter;
use tauri_specta::Event as TauriSpectaEvent;

use log::info;

pub use self::legacy::convert_legacy_database;
pub use self::models::NormalizedGame;
pub use self::models::Puzzle;
pub(crate) use self::search::PositionCache;
pub use self::search::{is_position_in_db, search_position, PositionQueryJs};

const GAME_COLUMNS: &[&str] = &[
    "event",
    "site",
    "round",
    "fen",
    "white",
    "black",
    "white_rating",
    "black_rating",
    "white_title",
    "black_title",
    "result",
    "time_control",
    "ply_count",
    "utc_timestamp",
    "movedata",
    "annotations",
];

fn game_appender(db: &Connection) -> duckdb::Result<duckdb::Appender<'_>> {
    db.appender_with_columns("games", GAME_COLUMNS)
}

#[derive(Debug)]
struct DuckdbConnectionCustomizer {
    extension_path: PathBuf,
}

impl CustomizeConnection<Connection, duckdb::Error> for DuckdbConnectionCustomizer {
    fn on_acquire(&self, connection: &mut Connection) -> Result<(), duckdb::Error> {
        load_aixchess_extension(connection, &self.extension_path)
            .map_err(|err| duckdb::Error::InvalidParameterName(err.to_string()))
    }
}

fn sql_literal(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

fn name_search_clauses(query: &str) -> Vec<String> {
    query
        .split(|c: char| !c.is_alphanumeric())
        .filter(|term| !term.is_empty())
        .map(|term| {
            format!(
                r"contains(regexp_replace(lower(name), '[^\p{{L}}\p{{N}}]+', ' ', 'g'), lower({}))",
                sql_literal(term)
            )
        })
        .collect()
}

pub fn create_duckdb_pool(
    path: &Path,
    extension_path: &Path,
) -> Result<Pool<DuckdbConnectionManager>, Error> {
    let config = Config::default()
        .allow_unsigned_extensions()?
        .access_mode(AccessMode::ReadWrite)?;
    let manager = DuckdbConnectionManager::file_with_flags(path, config)?;
    let pool = Pool::builder()
        .connection_customizer(Box::new(DuckdbConnectionCustomizer {
            extension_path: extension_path.to_path_buf(),
        }))
        .build(manager)?;
    Ok(pool)
}

fn duckdb_pool_key(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn get_duckdb_pool(
    state: &AppState,
    path: &Path,
) -> Result<Arc<Pool<DuckdbConnectionManager>>, Error> {
    database_pool(state, path)?.ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "This database uses an older format. Convert it from the Databases page before using it.",
        ).into()
    })
}

/// None identifies a legacy SQLite database; current databases share one pool.
fn database_pool(
    state: &AppState,
    path: &Path,
) -> Result<Option<Arc<Pool<DuckdbConnectionManager>>>, Error> {
    get_or_create_database_pool(state, path, || {
        let extension_path = state
            .aixchess_extension_path
            .lock()
            .map_err(|_| std::io::Error::other("aixchess extension path mutex poisoned"))?
            .clone()
            .ok_or_else(|| {
                std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "aixchess extension resource path is not initialized",
                )
            })?;
        create_duckdb_pool(path, &extension_path)
    })
}

fn get_or_create_database_pool(
    state: &AppState,
    path: &Path,
    create: impl FnOnce() -> Result<Pool<DuckdbConnectionManager>, Error>,
) -> Result<Option<Arc<Pool<DuckdbConnectionManager>>>, Error> {
    // Hold the entry through detection and creation. A second caller must not
    // probe the file while the first caller opens it: DuckDB's Windows handle
    // can deny that separate read, even within this process.
    match state.duckdb_connection_pool.entry(duckdb_pool_key(path)) {
        Entry::Occupied(entry) => match entry.get() {
            Some(pool) => Ok(Some(pool.clone())),
            None => Err(std::io::Error::other(
                "The database is being compacted. Try again when it finishes.",
            )
            .into()),
        },
        Entry::Vacant(entry) => {
            if path.exists() && legacy::is_sqlite(path)? {
                return Ok(None);
            }
            let pool = Arc::new(create()?);
            entry.insert(Some(pool.clone()));
            Ok(Some(pool))
        }
    }
}

pub fn remove_duckdb_pool(state: &AppState, path: &Path) {
    let key = duckdb_pool_key(path);
    state.player_catalogs.remove(&key);
    state.position_caches.remove(&key);
    state.duckdb_connection_pool.remove(&key);
}

fn player_catalog_cache(state: &AppState, path: &Path) -> Arc<Mutex<Option<Connection>>> {
    state
        .player_catalogs
        .entry(duckdb_pool_key(path))
        .or_insert_with(|| Arc::new(Mutex::new(None)))
        .clone()
}

fn ensure_player_catalog<'a>(
    cache: &'a mut Option<Connection>,
    source: &Connection,
) -> Result<&'a Connection, Error> {
    if cache.is_none() {
        let connection = source.try_clone()?;
        connection.execute_batch(
            "CREATE TEMP TABLE ec_player_catalog AS
             WITH all_players AS (
                 SELECT white AS name, MAX(white_rating) AS elo FROM games GROUP BY white
                 UNION ALL
                 SELECT black AS name, MAX(black_rating) AS elo FROM games GROUP BY black
             )
             SELECT name, MAX(elo) AS elo FROM all_players GROUP BY name;",
        )?;
        *cache = Some(connection);
    }
    Ok(cache.as_ref().expect("player catalog initialized"))
}

struct DatabaseCacheInvalidation<'a> {
    state: &'a AppState,
    path: &'a Path,
}

impl<'a> DatabaseCacheInvalidation<'a> {
    fn new(state: &'a AppState, path: &'a Path) -> Self {
        state.player_catalogs.remove(&duckdb_pool_key(path));
        state.position_caches.remove(&duckdb_pool_key(path));
        Self { state, path }
    }
}

impl Drop for DatabaseCacheInvalidation<'_> {
    fn drop(&mut self) {
        self.state
            .player_catalogs
            .remove(&duckdb_pool_key(self.path));
        self.state
            .position_caches
            .remove(&duckdb_pool_key(self.path));
    }
}

pub fn load_aixchess_extension(
    connection: &Connection,
    extension_path: &Path,
) -> Result<(), Error> {
    if !extension_path.exists() {
        return Err(Error::Io(Box::new(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!(
                "aixchess extension not found at: {}",
                extension_path.display()
            ),
        ))));
    }

    let extension_path_str = extension_path.to_string_lossy();
    let load_local_sql = format!("LOAD {};", sql_literal(extension_path_str.as_ref()));
    connection.execute_batch(&load_local_sql)?;
    info!(
        "Loaded local unsigned aixchess extension from: {}",
        extension_path.display()
    );
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn convert_pgn(
    files: Vec<PathBuf>,
    db_path: PathBuf,
    timestamp: Option<i32>,
    app: tauri::AppHandle,
    title: String,
    description: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    if files.is_empty() {
        return Ok(());
    }

    let db_exists = db_path.exists();

    let db_pool = get_duckdb_pool(&state, &db_path)?;
    let db = db_pool.get()?;
    let _invalidate_caches = DatabaseCacheInvalidation::new(&state, &db_path);

    prepare_pgn_import(&db, db_exists, &title, description.as_deref())?;

    let start = Instant::now();
    let appender = game_appender(&db)?;
    let mut proc = pgn::PgnProcessor::new(appender, AixCompressionLevel::Low, true, timestamp);
    let mut next_progress_emit = 10_000u32;

    for file_path in files {
        let file = File::open(&file_path)?;
        let uncompressed: Box<dyn std::io::Read> =
            if file_path.extension().and_then(|s| s.to_str()) == Some("bz2") {
                Box::new(bzip2::read::MultiBzDecoder::new(file))
            } else if file_path.extension().and_then(|s| s.to_str()) == Some("zst") {
                Box::new(zstd::Decoder::new(file)?)
            } else {
                Box::new(file)
            };

        let current_file_name = file_path
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_else(|| file_path.to_string_lossy().into_owned());

        let mut reader = pgn_reader::Reader::new(uncompressed);
        loop {
            let games_read = proc.read_batch(&mut reader).map_err(|error| {
                std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    format!("Failed to import '{}': {error}", file_path.display()),
                )
            })?;
            if games_read == 0 {
                break;
            }

            let imported_games = proc.count();
            while imported_games >= next_progress_emit {
                let elapsed = start.elapsed().as_millis() as u32;
                app.emit(
                    "convert_progress",
                    (imported_games, elapsed, Some(current_file_name.clone())),
                )
                .unwrap();
                next_progress_emit += 10_000;
            }
        }
    }

    proc.flush()?;
    db.execute("CHECKPOINT", [])?;

    let total_games = proc.count();
    let elapsed = start.elapsed().as_millis() as u32;
    let _ = app.emit(
        "convert_progress",
        (total_games, elapsed, Option::<String>::None),
    );

    Ok(())
}

fn prepare_pgn_import(
    db: &Connection,
    db_exists: bool,
    title: &str,
    description: Option<&str>,
) -> Result<(), Error> {
    if db_exists {
        return Ok(());
    }

    db.execute_batch(include_str!("init-database.sql"))?;
    db.execute_batch("CREATE TABLE db_info (name VARCHAR PRIMARY KEY, value VARCHAR);")?;
    db.execute(
        "INSERT INTO db_info (name, value) VALUES ('title', ?), ('description', ?);",
        params![title, description.unwrap_or_default()],
    )?;
    Ok(())
}

#[derive(Serialize, Type)]
pub struct DatabaseInfo {
    needs_conversion: bool,
    title: String,
    description: String,
    player_count: i32,
    event_count: i32,
    game_count: i32,
    storage_size: u64,
    filename: String,
}

#[tauri::command]
#[specta::specta]
pub async fn get_db_info(
    file: PathBuf,
    state: tauri::State<'_, AppState>,
) -> Result<DatabaseInfo, Error> {
    info!("get_db_info {:?}", file);

    read_database_info(&file, &state)
}

fn read_database_info(path: &Path, state: &AppState) -> Result<DatabaseInfo, Error> {
    let storage_size = path.metadata()?.len();
    // Metadata queries must reuse DuckDB's handle before attempting a raw read.
    let Some(db_pool) = database_pool(state, path)? else {
        return legacy::database_info(path);
    };
    let db = db_pool.get()?;

    let event_count = db.query_row("SELECT COUNT(DISTINCT event) FROM games;", [], |row| {
        row.get::<_, i32>(0)
    })?;

    let game_count = db.query_row("SELECT COUNT(*) FROM games;", [], |row| {
        row.get::<_, i32>(0)
    })?;

    let cache = player_catalog_cache(state, path);
    let mut catalog = cache
        .lock()
        .map_err(|_| std::io::Error::other("player catalog mutex poisoned"))?;
    let player_count = ensure_player_catalog(&mut catalog, &db)?.query_row(
        "SELECT COUNT(name) FROM ec_player_catalog;",
        [],
        |row| row.get::<_, i32>(0),
    )?;
    drop(catalog);

    let filename = path.file_name().expect("get filename").to_string_lossy();

    let mut title = filename.to_string();
    let mut description = String::new();

    if let Ok(db_title) = db.query_row(
        "SELECT value FROM db_info WHERE name = 'title' LIMIT 1;",
        [],
        |row| row.get::<_, String>(0),
    ) {
        title = db_title;
    }

    if let Ok(db_description) = db.query_row(
        "SELECT value FROM db_info WHERE name = 'description' LIMIT 1;",
        [],
        |row| row.get::<_, String>(0),
    ) {
        description = db_description;
    }

    Ok(DatabaseInfo {
        needs_conversion: false,
        title,
        description,
        player_count,
        game_count,
        event_count,
        storage_size,
        filename: filename.to_string(),
    })
}

#[tauri::command]
#[specta::specta]
pub async fn edit_db_info(
    file: PathBuf,
    title: Option<String>,
    description: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let db_pool = get_duckdb_pool(&state, &file)?;
    let db = db_pool.get()?;

    db.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS db_info (
            name VARCHAR PRIMARY KEY,
            value VARCHAR
        );
        ",
    )?;

    if let Some(title) = title {
        db.execute("DELETE FROM db_info WHERE name = 'title';", [])?;
        db.execute(
            "INSERT INTO db_info (name, value) VALUES ('title', ?);",
            params![title],
        )?;
    }

    if let Some(description) = description {
        db.execute("DELETE FROM db_info WHERE name = 'description';", [])?;
        db.execute(
            "INSERT INTO db_info (name, value) VALUES ('description', ?);",
            params![description],
        )?;
    }

    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash, Type)]
pub enum Sides {
    BlackWhite,
    WhiteBlack,
    Any,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, Eq, Hash, Type)]
pub enum GameSort {
    #[default]
    #[serde(rename = "id")]
    Id,
    #[serde(rename = "date")]
    Date,
    #[serde(rename = "whiteElo")]
    WhiteElo,
    #[serde(rename = "blackElo")]
    BlackElo,
    #[serde(rename = "averageElo")]
    AverageElo,
    #[serde(rename = "ply_count")]
    PlyCount,
}

#[derive(Default, Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash, Type)]
pub enum SortDirection {
    #[serde(rename = "asc")]
    Asc,
    #[default]
    #[serde(rename = "desc")]
    Desc,
}

#[derive(Default, Debug, Clone, Deserialize, PartialEq, Eq, Hash, Type)]
#[serde(rename_all = "camelCase")]
pub struct QueryOptions<SortT> {
    pub skip_count: bool,
    #[specta(optional)]
    pub page: Option<i32>,
    #[specta(optional)]
    pub page_size: Option<i32>,
    pub sort: SortT,
    pub direction: SortDirection,
}

#[derive(Debug, Clone, Default, Deserialize, PartialEq, Eq, Hash, Type)]
pub struct GameQuery {
    #[specta(optional)]
    pub options: Option<QueryOptions<GameSort>>,
    #[specta(optional)]
    pub player1: Option<String>,
    #[specta(optional)]
    pub player2: Option<String>,
    #[specta(optional)]
    pub tournament: Option<String>,
    #[specta(optional)]
    pub start_date: Option<String>,
    #[specta(optional)]
    pub end_date: Option<String>,
    #[specta(optional)]
    pub range1: Option<(i32, i32)>,
    #[specta(optional)]
    pub range2: Option<(i32, i32)>,
    #[specta(optional)]
    pub sides: Option<Sides>,
    #[specta(optional)]
    pub outcome: Option<String>,
    #[specta(optional)]
    pub position: Option<PositionQueryJs>,
    #[specta(optional)]
    pub wanted_result: Option<String>,
}

impl GameQuery {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn position(mut self, position: PositionQueryJs) -> Self {
        self.position = Some(position);
        self
    }
}

#[derive(Debug, Clone, Serialize, Type)]
pub struct QueryResponse<T> {
    pub data: T,
    pub count: Option<i32>,
}

fn build_game_where_clauses(query: &GameQuery) -> Vec<String> {
    let mut clauses = Vec::new();

    if let Some(outcome) = query.outcome.as_deref() {
        clauses.push(format!("result = {}", sql_literal(outcome)));
    }

    if let Some(start_date) = query.start_date.as_deref() {
        clauses.push(format!(
            "utc_timestamp >= strptime({}, '%Y.%m.%d')",
            sql_literal(start_date)
        ));
    }

    if let Some(end_date) = query.end_date.as_deref() {
        clauses.push(format!(
            "utc_timestamp < strptime({}, '%Y.%m.%d') + INTERVAL 1 DAY",
            sql_literal(end_date)
        ));
    }

    if let Some(tournament) = query.tournament.as_deref() {
        clauses.push(format!("event = {}", sql_literal(tournament)));
    }

    match query.sides.as_ref() {
        Some(Sides::WhiteBlack) => {
            if let Some(player1) = query.player1.as_deref() {
                clauses.push(format!("white = {}", sql_literal(player1)));
            }
            if let Some(player2) = query.player2.as_deref() {
                clauses.push(format!("black = {}", sql_literal(player2)));
            }
            if let Some(range1) = query.range1 {
                clauses.push(format!(
                    "white_rating BETWEEN {} AND {}",
                    range1.0, range1.1
                ));
            }
            if let Some(range2) = query.range2 {
                clauses.push(format!(
                    "black_rating BETWEEN {} AND {}",
                    range2.0, range2.1
                ));
            }
        }
        Some(Sides::BlackWhite) => {
            if let Some(player1) = query.player1.as_deref() {
                clauses.push(format!("black = {}", sql_literal(player1)));
            }
            if let Some(player2) = query.player2.as_deref() {
                clauses.push(format!("white = {}", sql_literal(player2)));
            }
            if let Some(range1) = query.range1 {
                clauses.push(format!(
                    "black_rating BETWEEN {} AND {}",
                    range1.0, range1.1
                ));
            }
            if let Some(range2) = query.range2 {
                clauses.push(format!(
                    "white_rating BETWEEN {} AND {}",
                    range2.0, range2.1
                ));
            }
        }
        Some(Sides::Any) => {
            if let Some(player1) = query.player1.as_deref() {
                let lit = sql_literal(player1);
                clauses.push(format!("(white = {} OR black = {})", lit, lit));
            }
            if let Some(player2) = query.player2.as_deref() {
                let lit = sql_literal(player2);
                clauses.push(format!("(white = {} OR black = {})", lit, lit));
            }
            if let (Some(range1), Some(range2)) = (query.range1, query.range2) {
                clauses.push(format!(
                    "((white_rating BETWEEN {} AND {}) OR (black_rating BETWEEN {} AND {}) OR (white_rating BETWEEN {} AND {}) OR (black_rating BETWEEN {} AND {}))",
                    range1.0, range1.1, range1.0, range1.1,
                    range2.0, range2.1, range2.0, range2.1,
                ));
            } else {
                if let Some(range1) = query.range1 {
                    clauses.push(format!(
                        "((white_rating BETWEEN {} AND {}) OR (black_rating BETWEEN {} AND {}))",
                        range1.0, range1.1, range1.0, range1.1,
                    ));
                }
                if let Some(range2) = query.range2 {
                    clauses.push(format!(
                        "((white_rating BETWEEN {} AND {}) OR (black_rating BETWEEN {} AND {}))",
                        range2.0, range2.1, range2.0, range2.1,
                    ));
                }
            }
        }
        None => {}
    }

    if let Some(position) = query.position.as_ref() {
        if position.type_ == "exact"
            && position.fen.split_whitespace().count() >= 2
            && Fen::from_ascii(position.fen.as_bytes()).is_ok()
        {
            clauses.push(format!(
                "matches_fen(movedata, {}, fen)",
                sql_literal(&position.fen)
            ));
        } else if position.type_ == "scoutfish" {
            // position.fen contains the scoutfish JSON query string
            clauses.push(format!(
                "scoutfish_query(movedata, {}, fen)",
                sql_literal(&position.fen)
            ));
        }
    }

    clauses
}

fn build_game_order_clause(query_options: &QueryOptions<GameSort>) -> String {
    let dir = match query_options.direction {
        SortDirection::Asc => "ASC",
        SortDirection::Desc => "DESC",
    };

    let col = match query_options.sort {
        GameSort::Id => "id",
        GameSort::Date => "utc_timestamp",
        GameSort::WhiteElo => "white_rating",
        GameSort::BlackElo => "black_rating",
        GameSort::AverageElo => {
            return format!(
                "ORDER BY (COALESCE(white_rating::INTEGER, 0) + COALESCE(black_rating::INTEGER, 0)) / 2.0 {dir}, id DESC"
            );
        }
        GameSort::PlyCount => "ply_count",
    };

    format!("ORDER BY {col} {dir}")
}

fn parse_normalized_game(row: &duckdb::Row) -> duckdb::Result<NormalizedGame> {
    let result = match row.get::<_, Option<String>>("result")?.as_deref() {
        Some("1-0") => Outcome::WhiteWin,
        Some("0-1") => Outcome::BlackWin,
        Some("1/2-1/2") => Outcome::Draw,
        _ => Outcome::Unknown,
    };

    let initial_fen = row.get::<_, Option<String>>("fen")?;
    let fen = initial_fen.clone().unwrap_or(Fen::default().to_string());
    let bare_moves =
        annotations::decode_movetext(&row.get::<_, Vec<u8>>("movedata")?, initial_fen.as_deref())
            .map_err(duckdb::Error::InvalidParameterName)?;

    Ok(NormalizedGame {
        id: row.get("id")?,
        event: row.get::<_, Option<String>>("event")?.unwrap_or_default(),
        site: row.get::<_, Option<String>>("site")?.unwrap_or_default(),
        round: row.get("round")?,
        fen,

        white: row.get::<_, Option<String>>("white")?.unwrap_or_default(),
        black: row.get::<_, Option<String>>("black")?.unwrap_or_default(),
        white_elo: row.get("white_rating")?,
        black_elo: row.get("black_rating")?,

        result,

        ply_count: row.get("ply_count")?,
        date: row.get("date")?,
        time: row.get("time")?,
        moves: annotations::restore_movetext(
            &bare_moves,
            row.get::<_, Option<Vec<u8>>>("annotations")?.as_deref(),
        )
        .map_err(duckdb::Error::InvalidParameterName)?,
        time_control: row.get("time_control")?,
        other: Some(
            [
                ("WhiteTitle", row.get::<_, Option<String>>("white_title")?),
                ("BlackTitle", row.get::<_, Option<String>>("black_title")?),
            ]
            .into_iter()
            .filter_map(|(key, value)| value.map(|value| (key.to_owned(), value)))
            .collect(),
        ),
    })
}

#[tauri::command]
#[specta::specta]
pub async fn get_games(
    file: PathBuf,
    query: GameQuery,
    state: tauri::State<'_, AppState>,
) -> Result<QueryResponse<Vec<NormalizedGame>>, Error> {
    let db_pool = get_duckdb_pool(&state, &file)?;
    let db = db_pool.get()?;

    let query_options = query.options.clone().unwrap_or_default();
    let where_clauses = build_game_where_clauses(&query);

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let order_sql = build_game_order_clause(&query_options);

    let pagination_sql = match (query_options.page, query_options.page_size) {
        (None, None) => String::new(),
        (page, page_size) => {
            let page_size = page_size.unwrap_or(25) as i64;
            let offset = page.map(|p| ((p - 1) as i64) * page_size).unwrap_or(0);
            format!("LIMIT {page_size} OFFSET {offset}")
        }
    };

    let data_sql = format!(
        "SELECT
            id,
            event,
            site,
            strftime(utc_timestamp, '%Y.%m.%d') AS date,
            strftime(utc_timestamp, '%H:%M:%S') AS time,
            round,
            fen,
            white,
            black,
            white_rating,
            black_rating,
            white_title,
            black_title,
            result,
            movedata,
            annotations,
            time_control,
            ply_count
        FROM games
        {where_sql}
        {order_sql}
        {pagination_sql};"
    );
    println!("Data SQL: {data_sql}");

    let games = db
        .prepare(&data_sql)?
        .query_map([], parse_normalized_game)?
        .collect::<Result<Vec<_>, _>>()?;

    let count = if query_options.skip_count {
        None
    } else {
        let count_sql = format!("SELECT COUNT(*) FROM games {where_sql};");
        Some(db.query_row(&count_sql, [], |row| row.get::<_, i32>(0))?)
    };

    Ok(QueryResponse { data: games, count })
}

#[derive(Debug, Clone, Deserialize, Type)]
pub struct PlayerQuery {
    pub options: QueryOptions<PlayerSort>,
    #[specta(optional)]
    pub name: Option<String>,
    #[specta(optional)]
    pub range: Option<(i32, i32)>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub enum PlayerSort {
    #[serde(rename = "name")]
    Name,
    #[serde(rename = "elo")]
    Elo,
}

#[tauri::command]
#[specta::specta]
pub async fn get_player(
    _file: PathBuf,
    _id: i32,
    _state: tauri::State<'_, AppState>,
) -> Result<Option<Player>, Error> {
    Ok(None)
}

#[tauri::command]
#[specta::specta]
pub async fn get_players(
    file: PathBuf,
    query: PlayerQuery,
    state: tauri::State<'_, AppState>,
) -> Result<QueryResponse<Vec<Player>>, Error> {
    let db_pool = get_duckdb_pool(&state, &file)?;
    let source = db_pool.get()?;
    let cache = player_catalog_cache(&state, &file);
    let mut catalog = cache
        .lock()
        .map_err(|_| std::io::Error::other("player catalog mutex poisoned"))?;
    let db = ensure_player_catalog(&mut catalog, &source)?;

    let mut where_clauses = vec!["name != 'Unknown'".to_string()];

    if let Some(name) = query.name.as_deref() {
        where_clauses.extend(name_search_clauses(name));
    }

    if let Some(range) = query.range {
        where_clauses.push(format!("elo BETWEEN {} AND {}", range.0, range.1));
    }

    let where_sql = format!("WHERE {}", where_clauses.join(" AND "));

    let dir = match query.options.direction {
        SortDirection::Asc => "ASC",
        SortDirection::Desc => "DESC",
    };
    let order_col = match query.options.sort {
        PlayerSort::Name => "name",
        PlayerSort::Elo => "elo",
    };
    let order_sql = format!("ORDER BY {order_col} {dir}");

    let page_size = query.options.page_size.unwrap_or(25) as i64;
    let offset = query
        .options
        .page
        .map(|p| ((p - 1) as i64) * page_size)
        .unwrap_or(0);

    let data_sql = format!(
        "SELECT name, elo
        FROM ec_player_catalog
        {where_sql}
        {order_sql}
        LIMIT {page_size} OFFSET {offset};"
    );

    let players = db
        .prepare(&data_sql)?
        .query_map([], |row| {
            Ok(Player {
                name: row.get("name")?,
                elo: row.get("elo")?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let count = if query.options.skip_count {
        None
    } else {
        let count_sql = format!("SELECT COUNT(*) FROM ec_player_catalog {where_sql};");
        Some(db.query_row(&count_sql, [], |row| row.get::<_, i32>(0))?)
    };

    Ok(QueryResponse {
        data: players,
        count,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub enum TournamentSort {
    #[serde(rename = "name")]
    Name,
    #[serde(rename = "games_count")]
    GamesCount,
}

#[derive(Debug, Clone, Deserialize, Type)]
pub struct TournamentQuery {
    pub options: QueryOptions<TournamentSort>,
    pub name: Option<String>,
}

#[tauri::command]
#[specta::specta]
pub async fn get_tournaments(
    file: PathBuf,
    query: TournamentQuery,
    state: tauri::State<'_, AppState>,
) -> Result<QueryResponse<Vec<Event>>, Error> {
    let db_pool = get_duckdb_pool(&state, &file)?;
    let db = db_pool.get()?;

    let mut where_clauses = vec!["name != 'Unknown'".to_string(), "name != ''".to_string()];

    if let Some(name) = query.name.as_deref() {
        where_clauses.extend(name_search_clauses(name));
    }

    let where_sql = format!("WHERE {}", where_clauses.join(" AND "));

    let dir = match query.options.direction {
        SortDirection::Asc => "ASC",
        SortDirection::Desc => "DESC",
    };
    let order_col = match query.options.sort {
        TournamentSort::Name => "name",
        TournamentSort::GamesCount => "games_count",
    };
    let order_sql = format!("ORDER BY {order_col} {dir}");

    let page_size = query.options.page_size.unwrap_or(25) as i64;
    let offset = query
        .options
        .page
        .map(|p| ((p - 1) as i64) * page_size)
        .unwrap_or(0);

    let data_sql = format!(
        "WITH events AS (
            SELECT event AS name, COUNT(*) AS games_count
            FROM games
            GROUP BY event
        )
        SELECT name, games_count
        FROM events
        {where_sql}
        {order_sql}
        LIMIT {page_size} OFFSET {offset};"
    );

    let events = db
        .prepare(&data_sql)?
        .query_map([], |row| {
            Ok(Event {
                name: row.get("name")?,
                games_count: row.get("games_count")?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let count = if query.options.skip_count {
        None
    } else {
        let count_sql = format!(
            "WITH events AS (
                SELECT DISTINCT event AS name FROM games
            )
            SELECT COUNT(*) FROM events {where_sql};"
        );
        Some(db.query_row(&count_sql, [], |row| row.get::<_, i32>(0))?)
    };

    Ok(QueryResponse {
        data: events,
        count,
    })
}

#[derive(Debug, Clone, Serialize, Type, Default)]
pub struct PlayerGameInfo {
    pub site_stats_data: Vec<SiteStatsData>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, Type)]
#[repr(u8)] // Ensure minimal memory usage (as u8)
pub enum GameOutcome {
    #[default]
    Won = 0,
    Drawn = 1,
    Lost = 2,
}

impl GameOutcome {
    pub fn from_str(result_str: &str, is_white: bool) -> Option<Self> {
        match result_str {
            "1-0" => Some(if is_white {
                GameOutcome::Won
            } else {
                GameOutcome::Lost
            }),
            "1/2-1/2" => Some(GameOutcome::Drawn),
            "0-1" => Some(if is_white {
                GameOutcome::Lost
            } else {
                GameOutcome::Won
            }),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Type, Default)]
pub struct SiteStatsData {
    pub site: String,
    pub player: String,
    pub data: Vec<StatsData>,
}

#[derive(Debug, Clone, Serialize, Type, Default)]
pub struct StatsData {
    pub date: String,
    pub is_player_white: bool,
    pub player_elo: i32,
    pub result: GameOutcome,
    pub time_control: String,
}

#[derive(Serialize, Debug, Clone, Type, tauri_specta::Event)]
pub struct DatabaseProgress {
    pub id: String,
    pub progress: f64,
}

fn normalize_site_name(site: &str) -> String {
    if site.starts_with("https://lichess.org/") {
        "Lichess".to_string()
    } else {
        site.to_string()
    }
}

#[tauri::command]
#[specta::specta]
pub async fn get_players_game_info(
    file: PathBuf,
    player: String,
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<PlayerGameInfo, Error> {
    let db_pool = get_duckdb_pool(&state, &file)?;
    let db = db_pool.get()?;

    let count_sql = "
        WITH filtered_games AS (
            SELECT
                *,
                white = ? AS is_player_white
            FROM games
            WHERE movedata IS NOT NULL
              AND result IN ('1-0', '0-1', '1/2-1/2')
              AND (white = ? OR black = ?)
        )
        SELECT COUNT(*)
        FROM filtered_games
        WHERE utc_timestamp IS NOT NULL
          AND (CASE WHEN is_player_white THEN white_rating ELSE black_rating END) IS NOT NULL;
    ";

    let total = db.query_row(count_sql, params![player, player, player], |row| {
        row.get::<_, i64>(0)
    })? as usize;

    if total == 0 {
        let _ = DatabaseProgress {
            id: player.clone(),
            progress: 100.0,
        }
        .emit(&app);
        return Ok(PlayerGameInfo::default());
    }

    let sql = "
        WITH filtered_games AS (
            SELECT
                *,
                white = ? AS is_player_white
            FROM games
            WHERE movedata IS NOT NULL
              AND result IN ('1-0', '0-1', '1/2-1/2')
              AND (white = ? OR black = ?)
        )
        SELECT
            site,
            COALESCE(CASE WHEN is_player_white THEN white ELSE black END, '') AS player,
            strftime(utc_timestamp, '%Y-%m-%d') AS date,
            is_player_white,
            CAST(CASE WHEN is_player_white THEN white_rating ELSE black_rating END AS INTEGER) AS player_elo,
            result AS game_result,
            COALESCE(time_control, '') AS time_control
        FROM filtered_games
        WHERE utc_timestamp IS NOT NULL
          AND (CASE WHEN is_player_white THEN white_rating ELSE black_rating END) IS NOT NULL
        ORDER BY utc_timestamp;
    ";

    let mut statement = db.prepare(sql)?;
    let mut rows = statement.query(params![player, player, player])?;

    let mut grouped: HashMap<(String, String), Vec<StatsData>> = HashMap::new();
    let mut processed = 0usize;

    while let Some(row) = rows.next()? {
        let site = row.get::<_, Option<String>>("site")?.unwrap_or_default();
        let player_name: String = row.get("player")?;
        let date: String = row.get("date")?;
        let is_player_white: bool = row.get("is_player_white")?;
        let player_elo: i32 = row.get("player_elo")?;
        let game_result: String = row.get("game_result")?;
        let time_control: String = row.get("time_control")?;

        let Some(result) = GameOutcome::from_str(game_result.as_str(), is_player_white) else {
            continue;
        };

        let site = normalize_site_name(site.as_str());

        grouped
            .entry((site, player_name))
            .or_default()
            .push(StatsData {
                date,
                is_player_white,
                player_elo,
                result,
                time_control,
            });

        processed += 1;
        if processed.is_multiple_of(1000) || processed == total {
            let _ = DatabaseProgress {
                id: player.clone(),
                progress: (processed as f64 / total as f64) * 100.0,
            }
            .emit(&app);
        }
    }

    let site_stats_data = grouped
        .into_iter()
        .map(|((site, player), data)| SiteStatsData { site, player, data })
        .collect();

    Ok(PlayerGameInfo { site_stats_data })
}

#[tauri::command]
#[specta::specta]
pub async fn delete_database(
    file: PathBuf,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    remove_duckdb_pool(&state, &file);

    let path_str = file.to_str().unwrap();

    remove_file(path_str)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn compact_database(
    file: PathBuf,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    compact_database_file(&state, &file)
}

fn compact_database_file(state: &AppState, file: &Path) -> Result<(), Error> {
    let mut entry = state.duckdb_connection_pool.entry(duckdb_pool_key(file));
    if let Entry::Occupied(entry) = &entry {
        if let Some(pool) = entry.get() {
            if Arc::strong_count(pool) != 1
                || pool.state().connections != pool.state().idle_connections
            {
                return Err(std::io::Error::other(
                    "The database is in use. Wait for other database operations to finish and try again.",
                ).into());
            }
        }
    }
    state.player_catalogs.remove(&duckdb_pool_key(file));
    state.position_caches.remove(&duckdb_pool_key(file));
    if let Entry::Occupied(entry) = &mut entry {
        drop(entry.get_mut().take());
    }
    let result = compact_db(file);
    if let Entry::Occupied(entry) = entry {
        entry.remove();
    }
    result
}

fn compact_db(file: &Path) -> Result<(), Error> {
    if !file.is_file() {
        return Err(std::io::Error::other("The database file no longer exists.").into());
    }
    let temporary = tempfile::tempdir_in(file.parent().unwrap_or(Path::new(".")))?;
    let compacted = temporary.path().join("compacted.duckdb");
    {
        let db = Connection::open_in_memory()?;
        db.execute_batch(&format!(
            "ATTACH {} AS original;
             ATTACH {} AS compacted;
             COPY FROM DATABASE original TO compacted;
             CHECKPOINT compacted;
             DETACH compacted;
             DETACH original;",
            sql_literal(&file.to_string_lossy()),
            sql_literal(&compacted.to_string_lossy()),
        ))?;
    }
    OpenOptions::new()
        .write(true)
        .open(&compacted)
        .and_then(|db| db.sync_all())
        .map_err(|err| {
            std::io::Error::other(format!("Failed to sync compacted database: {err}"))
        })?;
    std::fs::set_permissions(&compacted, file.metadata()?.permissions()).map_err(|err| {
        std::io::Error::other(format!("Failed to preserve database permissions: {err}"))
    })?;
    tempfile::TempPath::from_path(compacted)
        .persist(file)
        .map_err(|err| {
            std::io::Error::other(format!("Failed to replace database: {}", err.error))
        })?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_duplicated_games(
    file: PathBuf,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let db_pool = get_duckdb_pool(&state, &file)?;
    let db = db_pool.get()?;
    let _invalidate_caches = DatabaseCacheInvalidation::new(&state, &file);

    remove_duplicated_games(&db)?;
    Ok(())
}

fn remove_duplicated_games(db: &Connection) -> duckdb::Result<()> {
    db.execute_batch(
        "
        DELETE FROM games
        WHERE id IN (
            SELECT id
            FROM (
                SELECT id,
                    ROW_NUMBER() OVER (
                        PARTITION BY event, site, round, fen, white, black,
                            white_rating, black_rating, white_title, black_title,
                            result, time_control, ply_count, movedata, utc_timestamp, annotations
                        ORDER BY id
                    ) AS row_num
                FROM games
            )
            WHERE row_num > 1
        );
        ",
    )?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_empty_games(
    file: PathBuf,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let db_pool = get_duckdb_pool(&state, &file)?;
    let db = db_pool.get()?;
    let _invalidate_caches = DatabaseCacheInvalidation::new(&state, &file);

    remove_empty_games(&db)?;

    Ok(())
}

fn remove_empty_games(db: &Connection) -> duckdb::Result<()> {
    db.execute(
        "DELETE FROM games WHERE ply_count = 0 AND annotations IS NULL;",
        [],
    )?;
    Ok(())
}

fn export_game(row: &duckdb::Row) -> duckdb::Result<String> {
    let game = parse_normalized_game(row)?;
    let mut tags = std::collections::BTreeMap::new();
    for (key, value) in [
        ("Event", game.event),
        ("Site", game.site),
        ("Round", game.round.unwrap_or_default()),
        ("White", game.white),
        ("Black", game.black),
        ("Date", game.date.unwrap_or_else(|| "????.??.??".into())),
    ] {
        tags.insert(key.into(), value);
    }
    for (key, value) in [
        ("UTCTime", game.time),
        ("WhiteElo", game.white_elo.map(|elo| elo.to_string())),
        ("BlackElo", game.black_elo.map(|elo| elo.to_string())),
        ("WhiteTitle", row.get("white_title")?),
        ("BlackTitle", row.get("black_title")?),
        ("TimeControl", game.time_control),
        ("PlyCount", game.ply_count.map(|count| count.to_string())),
    ] {
        if let Some(value) = value {
            tags.insert(key.into(), value);
        }
    }
    if let Some(fen) = row.get::<_, Option<String>>("fen")? {
        tags.insert("FEN".into(), fen);
        tags.insert("SetUp".into(), "1".into());
    }
    let result = row
        .get::<_, Option<String>>("result")?
        .unwrap_or_else(|| "*".into());
    tags.insert("Result".into(), result.clone());
    Ok(format!(
        "{}\n{} {}\n\n",
        annotations::write_tags(&tags),
        game.moves,
        result
    ))
}

#[tauri::command]
#[specta::specta]
pub async fn export_to_pgn(
    file: PathBuf,
    dest_file: PathBuf,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let db_pool = get_duckdb_pool(&state, &file)?;
    let db = db_pool.get()?;

    let output_file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(dest_file)?;

    let mut writer = BufWriter::new(output_file);
    let mut statement = db.prepare(
        "SELECT id, event, site, round, fen, white, black,
            white_rating, black_rating, white_title, black_title, result, time_control, ply_count,
            strftime(utc_timestamp, '%Y.%m.%d') AS date,
            strftime(utc_timestamp, '%H:%M:%S') AS time,
            movedata, annotations
         FROM games ORDER BY id;",
    )?;
    let rows = statement.query_map([], export_game)?;
    for row in rows {
        writer.write_all(row?.as_bytes())?;
    }
    writer.flush()?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_db_game(
    file: PathBuf,
    game_id: i32,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let db_pool = get_duckdb_pool(&state, &file)?;
    let db = db_pool.get()?;
    let _invalidate_caches = DatabaseCacheInvalidation::new(&state, &file);

    db.execute("DELETE FROM games WHERE id = ?;", params![game_id])?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn write_db_game(
    file: PathBuf,
    game_id: i32,
    pgn: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let db_pool = get_duckdb_pool(&state, &file)?;
    let db = db_pool.get()?;

    let _invalidate_caches = DatabaseCacheInvalidation::new(&state, &file);
    update_game(&db, game_id, &pgn)
}

fn update_game(db: &Connection, game_id: i32, pgn: &str) -> Result<(), Error> {
    let game = pgn::parse_single_game(pgn)
        .map_err(|msg| std::io::Error::new(std::io::ErrorKind::InvalidData, msg))?;
    let mut values = game.database_values();
    values.push(game_id.into());
    // A single statement atomically replaces the move tree, annotations and
    // headers, preventing annotation anchors or derived metadata going stale.
    let changed = db.execute(
        "UPDATE games SET event = ?, site = ?, round = ?, fen = ?,
            white = ?, black = ?, white_rating = ?, black_rating = ?,
            white_title = ?, black_title = ?, result = ?, time_control = ?,
            ply_count = ?, utc_timestamp = ?, movedata = ?, annotations = ?
         WHERE id = ?;",
        duckdb::params_from_iter(values),
    )?;
    if changed == 0 {
        return Err(Error::GameNotFound(game_id.to_string()));
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn merge_players(
    file: PathBuf,
    player1_name: String,
    player2_name: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let db_pool = get_duckdb_pool(&state, &file)?;
    let db = db_pool.get()?;
    let _invalidate_caches = DatabaseCacheInvalidation::new(&state, &file);

    db.execute(
        "UPDATE games SET white = ? WHERE white = ?;",
        params![player2_name, player1_name],
    )?;

    db.execute(
        "UPDATE games SET black = ? WHERE black = ?;",
        params![player2_name, player1_name],
    )?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn game_ids_survive_checkpoints_reopening_and_compaction() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("stable-ids.duckdb");
        {
            let db = Connection::open(&path).unwrap();
            db.execute_batch(include_str!("init-database.sql")).unwrap();
            db.execute_batch(
                "INSERT INTO games (white) SELECT 'Game ' || i FROM range(1000000) AS t(i);
                 CHECKPOINT;
                 DELETE FROM games WHERE (id < 500000 AND id % 2 = 0) OR id = 999999;
                 CHECKPOINT;",
            )
            .unwrap();
        }
        {
            let db = Connection::open(&path).unwrap();
            assert_eq!(
                db.query_row("SELECT white FROM games WHERE id = 300001", [], |row| {
                    row.get::<_, String>(0)
                })
                .unwrap(),
                "Game 300001"
            );
            update_game(&db, 300001, "[White \"Edited\"]\n\n1. e4 *").unwrap();
        }
        compact_db(&path).unwrap();
        let db = Connection::open(&path).unwrap();
        assert_eq!(
            db.query_row("SELECT white FROM games WHERE id = 300001", [], |row| {
                row.get::<_, String>(0)
            })
            .unwrap(),
            "Edited"
        );
        assert_eq!(
            db.query_row("SELECT white FROM games WHERE id = 354243", [], |row| {
                row.get::<_, String>(0)
            })
            .unwrap(),
            "Game 354243"
        );
        let id: i32 = db
            .query_row(
                "INSERT INTO games (white) VALUES ('New') RETURNING id",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(
            id >= 1_000_000,
            "Compaction must retain the sequence's high-water mark"
        );
    }

    #[test]
    fn name_search_ignores_word_order_and_punctuation() {
        let db = Connection::open_in_memory().unwrap();
        for (name, query, expected) in [
            ("Carlsen, Magnus", "Magnus Carlsen", true),
            ("Carlsen,Magnus", "  MAGNUS, carlsen. ", true),
            ("Carlsen, M.", "M Carlsen", true),
            ("Carlsen, Magnus", "Magn Carl", true),
            ("Tata Steel-Masters (2024)", "2024 masters tata", true),
            ("Tata Steel-Masters (2024)", "tata/steel", true),
            ("Duda, Jan-Krzysztof", "Krzysztof Jan Duda", true),
            ("O'Brien, Seán", "Seán O'Brien", true),
            ("Carlsen, Magnus", "Magnus Kasparov", false),
            ("Carlsen, M.", "Magnus Carlsen", false),
            ("Tata Steel Masters 2023", "tata 2024", false),
            ("Tata Steel Masters 2024", "tata%masters", true),
            ("Tata Steel Masters 2024", "tata_unknown", false),
        ] {
            let clauses = name_search_clauses(query).join(" AND ");
            let sql = format!(
                "SELECT {clauses} FROM (SELECT {} AS name)",
                sql_literal(name)
            );
            let matches: bool = db.query_row(&sql, [], |row| row.get(0)).unwrap();
            assert_eq!(matches, expected, "query {query:?} against {name:?}");
        }
        assert!(name_search_clauses(" ,.- ").is_empty());
    }

    #[test]
    fn metadata_reuses_an_open_database_without_reopening_its_file() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("open.duckdb");
        let state = AppState::default();
        let pool = get_or_create_database_pool(&state, &path, || {
            Ok(Pool::builder()
                .max_size(1)
                .build(DuckdbConnectionManager::file(&path)?)?)
        })
        .unwrap()
        .unwrap();
        pool.get()
            .unwrap()
            .execute_batch(include_str!("init-database.sql"))
            .unwrap();

        // Keep the real file-backed DuckDB pool alive across repeated refreshes.
        // On Windows a separate File::open can conflict with this handle.
        for _ in 0..3 {
            let info = read_database_info(&path, &state).unwrap();
            assert!(!info.needs_conversion);
            assert_eq!(info.game_count, 0);
            assert_eq!(info.filename, "open.duckdb");
        }
        get_or_create_database_pool(&state, &path, || panic!("Must reuse the open pool"))
            .unwrap()
            .unwrap();
    }

    #[test]
    fn concurrent_database_opens_create_one_pool() {
        use std::sync::{
            atomic::{AtomicUsize, Ordering},
            Barrier,
        };

        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("concurrent.duckdb");
        let state = AppState::default();
        let starts = Barrier::new(8);
        let creations = AtomicUsize::new(0);
        std::thread::scope(|scope| {
            for _ in 0..8 {
                scope.spawn(|| {
                    starts.wait();
                    get_or_create_database_pool(&state, &path, || {
                        creations.fetch_add(1, Ordering::SeqCst);
                        Ok(Pool::builder()
                            .max_size(1)
                            .build(DuckdbConnectionManager::file(&path)?)?)
                    })
                    .unwrap()
                    .unwrap()
                    .get()
                    .unwrap()
                    .execute_batch("SELECT 1")
                    .unwrap();
                });
            }
        });
        assert_eq!(creations.load(Ordering::SeqCst), 1);
    }

    const ANNOTATED_PGN: &str = r#"[Event "Annotation test"]
[Site "Lisboa"]
[Date "2026.??.??"]
[Round "1"]
[White "Original"]
[Black "Opponent"]
[Result "*"]
[WhiteElo "2100"]
[WhiteTitle "IM"]
[BlackTitle "GM"]
[TimeControl "300+3"]
[ECO "C20"]
[Annotator "Ana \"Quoted\" \\ Name"]

{Root comentário} 1. e4 $1 $255 {First} {Second [%eval 0.25,18] [%clk 0:04:59.125] [%emt 0:00:00.875] [%cal Ge2e4] [%csl Re4] [%custom keep]}
( {Variation introduction} 1. d4 $2 {Sibling} d5 (1... Nf6 {Nested [%eval #-3,22]}) 2. c4 )
(1. c4 {Other sibling}) 1... e5 2. Nf3 *"#;

    const READ_TEST_GAME: &str = "SELECT id, event, site, round, fen,
        white, black, white_rating, black_rating, white_title, black_title, result, time_control, ply_count,
        strftime(utc_timestamp, '%Y.%m.%d') AS date,
        strftime(utc_timestamp, '%H:%M:%S') AS time,
        movedata, annotations FROM games WHERE id = 0";

    #[test]
    fn supported_headers_export_from_columns_and_utc_timestamp() {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch(include_str!("init-database.sql")).unwrap();
        let input = "[Event \"Test\"]\n[Site \"Lisboa\"]\n[Round \"1\"]\n[White \"White\"]\n[Black \"Black\"]\n[Date \"2020.??.??\"]\n[Time \"01:02:03\"]\n[UTCDate \"2026.10.15\"]\n[UTCTime \"12:34:56\"]\n[WhiteElo \"02300\"]\n[BlackElo \"invalid\"]\n[UnknownTag \"discard\"]\n\n1. e4 *";
        let game = pgn::parse_single_game(input).unwrap();
        {
            let mut appender = game_appender(&db).unwrap();
            appender
                .append_row(duckdb::appender_params_from_iter(game.database_values()))
                .unwrap();
            appender.flush().unwrap();
        }
        let exported = db.query_row(READ_TEST_GAME, [], export_game).unwrap();
        assert!(exported.contains("[Date \"2026.10.15\"]"));
        assert!(exported.contains("[UTCTime \"12:34:56\"]"));
        assert!(exported.contains("[WhiteElo \"2300\"]"));
        assert!(!exported.contains("[BlackElo "));
        assert!(!exported.contains("[UnknownTag "));
        let original = pgn::parse_single_game(input).unwrap().database_values();
        let restored = pgn::parse_single_game(&exported).unwrap().database_values();
        assert_eq!(original, restored);
    }

    #[test]
    fn annotations_survive_import_reopen_edit_and_export() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("annotations.duckdb");
        {
            let db = Connection::open(&path).unwrap();
            db.execute_batch(include_str!("init-database.sql")).unwrap();
            let appender = game_appender(&db).unwrap();
            let mut processor =
                pgn::PgnProcessor::new(appender, AixCompressionLevel::Low, false, None);
            pgn_reader::Reader::new(ANNOTATED_PGN.as_bytes())
                .read_game(&mut processor)
                .unwrap()
                .unwrap()
                .unwrap();
            assert_eq!(processor.count(), 1);
            processor.flush().unwrap();
        }
        let db = Connection::open(&path).unwrap();
        let game = db
            .query_row(READ_TEST_GAME, [], parse_normalized_game)
            .unwrap();
        assert_eq!(game.date.as_deref(), Some("2026.01.01"));
        assert_eq!(game.time_control.as_deref(), Some("300+3"));
        let other = game.other.as_ref().unwrap();
        assert_eq!(other["WhiteTitle"], "IM");
        assert_eq!(other["BlackTitle"], "GM");
        assert!(!other.contains_key("ECO"));
        assert!(!other.contains_key("Annotator"));
        assert_eq!(game.ply_count, Some(3));
        for text in [
            "Root comentário",
            "$1",
            "$255",
            "First",
            "Second",
            "Variation introduction",
            "Sibling",
            "Nested [%eval #-3,22]",
            "Other sibling",
            "[%clk 0:04:59.125]",
            "[%cal Ge2e4]",
            "[%csl Re4]",
            "[%custom keep]",
        ] {
            assert!(game.moves.contains(text), "Missing {text}: {}", game.moves);
        }
        let exported = db.query_row(READ_TEST_GAME, [], export_game).unwrap();
        let first = pgn::parse_single_game(ANNOTATED_PGN).unwrap();
        let restored = pgn::parse_single_game(&exported).unwrap();
        assert_eq!(first.movedata, restored.movedata);
        assert_eq!(first.annotations, restored.annotations);
        assert_eq!(first.database_values(), restored.database_values());
        assert!(!exported.contains("[ECO "));
        assert!(!exported.contains("[Annotator "));

        let edited = exported
            .replace("Original", "Edited")
            .replace("Root comentário", "Edited root")
            .replace("2. Nf3", "2. Bc4")
            .replace("2026.01.01", "2026.10.15")
            .replace("2100", "2300")
            .replace("300+3", "600+5")
            .replace("*", "1-0");
        update_game(&db, 0, &edited).unwrap();
        let saved = db
            .query_row(READ_TEST_GAME, [], parse_normalized_game)
            .unwrap();
        assert_eq!(saved.white, "Edited");
        assert_eq!(saved.date.as_deref(), Some("2026.10.15"));
        assert_eq!(saved.white_elo, Some(2300));
        assert_eq!(saved.time_control.as_deref(), Some("600+5"));
        let dated: i32 = db
            .query_row(
                "SELECT COUNT(*) FROM games WHERE utc_timestamp = TIMESTAMP '2026-10-15 00:00:00'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(dated, 1);
        assert!(matches!(saved.result, Outcome::WhiteWin));
        assert!(saved.moves.contains("Edited root"));
        assert!(saved.moves.contains("Bc4"));
        assert!(!saved.moves.contains("Nf3"));
        let before: Vec<u8> = db
            .query_row("SELECT movedata FROM games", [], |row| row.get(0))
            .unwrap();
        assert!(update_game(&db, 0, "1. e4 e5 2. Qh8 *").is_err());
        assert_eq!(
            before,
            db.query_row::<Vec<u8>, _, _>("SELECT movedata FROM games", [], |row| row.get(0))
                .unwrap()
        );
        assert!(matches!(
            update_game(&db, 999, "1. e4 *"),
            Err(Error::GameNotFound(_))
        ));
    }

    #[test]
    fn annotation_only_games_and_custom_fen_are_preserved() {
        for input in [
            "[White \"Study\"]\n\n{Empty study [%custom root]} *",
            "[SetUp \"1\"]\n[FEN \"8/8/8/8/8/8/4K3/7k b - - 0 40\"]\n\n{Initial} 40... Kg2 $255 {[%eval #-2] [%clk 0:00:00]} *",
        ] {
            let game = pgn::parse_single_game(input).unwrap();
            let values = pgn::parse_single_game(input).unwrap().database_values();
            let fen = match &values[3] {
                duckdb::types::Value::Text(fen) => Some(fen.as_str()),
                _ => None,
            };
            let bare = annotations::decode_movetext(&game.movedata, fen).unwrap();
            if fen.is_some() { assert!(bare.starts_with("40... Kg2")); }
            let restored = annotations::restore_movetext(&bare, game.annotations.as_deref()).unwrap();
            assert!(restored.contains(if fen.is_some() { "[%eval #-2]" } else { "Empty study" }));
        }
    }

    #[test]
    fn long_comments_and_clearing_annotations_survive_saves() {
        let comment = "é".repeat(20_000);
        let game = pgn::parse_single_game(&format!("1. e4 {{{comment}}} *")).unwrap();
        let restored = annotations::restore_movetext("1. e4", game.annotations.as_deref()).unwrap();
        assert_eq!(restored, format!("1. e4 {{{comment}}}"));
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch(include_str!("init-database.sql")).unwrap();
        game_appender(&db)
            .unwrap()
            .append_row(duckdb::appender_params_from_iter(game.database_values()))
            .unwrap();
        let stored: Vec<u8> = db
            .query_row("SELECT annotations FROM games", [], |row| row.get(0))
            .unwrap();
        assert!(stored.len() < comment.len() / 10);
        let exported = db.query_row(READ_TEST_GAME, [], export_game).unwrap();
        assert!(exported.contains(&format!("{{{comment}}}")));
        update_game(&db, 0, "[PlyCount \"99\"]\n\n1. d4 d5 *").unwrap();
        let (annotations, count): (Option<Vec<u8>>, u16) = db
            .query_row("SELECT annotations, ply_count FROM games", [], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .unwrap();
        assert!(annotations.is_none());
        assert_eq!(count, 2);
        let exported = db.query_row(READ_TEST_GAME, [], export_game).unwrap();
        assert!(exported.contains("[PlyCount \"2\"]"));
    }

    #[test]
    fn maintenance_preserves_supported_headers_annotations_and_empty_studies() {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch(include_str!("init-database.sql")).unwrap();
        {
            let mut appender = game_appender(&db).unwrap();
            for input in [
                "1. e4 {First} *",
                "[Unsupported \"ignored\"]\n\n1. e4 {First} *",
                "[TimeControl \"300+3\"]\n\n1. e4 {First} *",
                "1. e4 {Different} *",
                "{Study} *",
                "*",
            ] {
                let game = pgn::parse_single_game(input).unwrap();
                appender
                    .append_row(duckdb::appender_params_from_iter(game.database_values()))
                    .unwrap();
            }
            appender.flush().unwrap();
        }
        remove_duplicated_games(&db).unwrap();
        remove_empty_games(&db).unwrap();
        let count: i32 = db
            .query_row("SELECT COUNT(*) FROM games", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 4);
        let empty_annotated: i32 = db
            .query_row(
                "SELECT COUNT(*) FROM games WHERE ply_count = 0 AND annotations IS NOT NULL",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(empty_annotated, 1);
    }

    fn catalog_fixture() -> Connection {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch(
            "CREATE TABLE games (white VARCHAR, black VARCHAR, white_rating INTEGER, black_rating INTEGER);
             INSERT INTO games VALUES
                 ('Carlsen', 'Kasparov', 2800, 2851),
                 ('Kasparov', 'Carlsen', 2800, 2882),
                 ('Unknown', 'O''Brien', NULL, 2200);",
        ).unwrap();
        db
    }

    #[test]
    fn player_catalog_combines_both_colors_and_reuses_the_snapshot() {
        let source = catalog_fixture();
        let mut cache = None;
        let catalog = ensure_player_catalog(&mut cache, &source).unwrap();
        let players: Vec<(String, i32)> = catalog.prepare(
            "SELECT name, elo FROM ec_player_catalog WHERE name != 'Unknown' ORDER BY elo DESC;",
        ).unwrap().query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .unwrap().collect::<Result<_, _>>().unwrap();
        assert_eq!(
            players,
            vec![
                ("Carlsen".into(), 2882),
                ("Kasparov".into(), 2851),
                ("O'Brien".into(), 2200),
            ]
        );
        // If a warm lookup rebuilt the catalog, it would fail without the source table.
        source.execute_batch("DROP TABLE games;").unwrap();
        let count: i32 = ensure_player_catalog(&mut cache, &source)
            .unwrap()
            .query_row("SELECT COUNT(*) FROM ec_player_catalog;", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(count, 4);
    }

    #[test]
    fn player_catalog_invalidation_refreshes_imports_merges_and_deletions() {
        let source = catalog_fixture();
        let state = AppState::default();
        let path = Path::new("catalog-test.db");
        let cache = player_catalog_cache(&state, path);
        ensure_player_catalog(&mut cache.lock().unwrap(), &source).unwrap();
        {
            let _invalidate = DatabaseCacheInvalidation::new(&state, path);
            source
                .execute_batch(
                    "INSERT INTO games VALUES ('New player', 'Kasparov', 2900, 2800);
                 UPDATE games SET white = 'Merged player' WHERE white = 'Carlsen';
                 DELETE FROM games WHERE black = 'Carlsen';",
                )
                .unwrap();
            // A lookup during the write must also be invalidated when it finishes.
            let during_write = player_catalog_cache(&state, path);
            ensure_player_catalog(&mut during_write.lock().unwrap(), &source).unwrap();
        }
        assert!(!state.player_catalogs.contains_key(&duckdb_pool_key(path)));
        let fresh_cache = player_catalog_cache(&state, path);
        let mut fresh = fresh_cache.lock().unwrap();
        let catalog = ensure_player_catalog(&mut fresh, &source).unwrap();
        let names: Vec<String> = catalog
            .prepare("SELECT name FROM ec_player_catalog WHERE name != 'Unknown' ORDER BY name;")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert_eq!(
            names,
            vec!["Kasparov", "Merged player", "New player", "O'Brien"]
        );
    }
}
