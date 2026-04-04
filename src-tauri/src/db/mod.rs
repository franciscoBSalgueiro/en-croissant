mod models;
mod pgn;
mod schema;
mod search;

use crate::{db::models::*, error::Error, AppState};
use aix_chess_compression::CompressionLevel as AixCompressionLevel;
use dashmap::mapref::entry::Entry;
use duckdb::{params, AccessMode, Config, Connection, DuckdbConnectionManager};
use r2d2::CustomizeConnection;
use r2d2::Pool;

use serde::{Deserialize, Serialize};
use shakmaty::fen::Fen;
use shakmaty::{san::San, Board, ByColor, Chess, EnPassantMode, Piece, Position};
use specta::Type;
use std::collections::HashMap;
use std::io::{BufWriter, Write};
use std::{
    fs::{remove_file, File, OpenOptions},
    path::{Path, PathBuf},
    time::Instant,
};
use tauri::Emitter;
use tauri_specta::Event as TauriSpectaEvent;

use log::info;

use crate::opening::get_opening_from_setup;

pub use self::models::NormalizedGame;
pub use self::models::Puzzle;
pub use self::schema::puzzle_themes;
pub use self::schema::puzzles;
pub use self::schema::themes;
pub use self::search::{is_position_in_db, search_position, PositionQueryJs, PositionStats};

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

fn get_duckdb_pool(state: &AppState, path: &Path) -> Result<Pool<DuckdbConnectionManager>, Error> {
    let key = duckdb_pool_key(path);

    if let Some(pool) = state.duckdb_connection_pool.get(&key) {
        return Ok(pool.clone());
    }

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

    let pool = create_duckdb_pool(path, &extension_path)?;
    match state.duckdb_connection_pool.entry(key) {
        Entry::Occupied(entry) => Ok(entry.get().clone()),
        Entry::Vacant(entry) => {
            entry.insert(pool.clone());
            Ok(pool)
        }
    }
}

pub fn remove_duckdb_pool(state: &AppState, path: &Path) {
    let key = duckdb_pool_key(path);
    state.duckdb_connection_pool.remove(&key);
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

    if !db_exists {
        db.execute_batch(include_str!("init-database.sql"))?;
    }

    db.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS db_info (
            name VARCHAR PRIMARY KEY,
            value VARCHAR
        );
        ",
    )?;

    let description_value = description.unwrap_or_default();
    db.execute(
        "DELETE FROM db_info WHERE name IN ('title', 'description');",
        [],
    )?;
    db.execute(
        "INSERT INTO db_info (name, value) VALUES ('title', ?), ('description', ?);",
        params![title, description_value],
    )?;

    let start = Instant::now();
    let appender = db.appender("games")?;
    let mut proc = pgn::PgnProcessor::new(appender, AixCompressionLevel::Low, true, timestamp);
    let mut next_progress_emit = 10_000u32;

    for file_path in files {
        let file = File::open(&file_path).unwrap();
        let uncompressed: Box<dyn std::io::Read> =
            if file_path.extension().and_then(|s| s.to_str()) == Some("zst") {
                Box::new(zstd::Decoder::new(file).unwrap())
            } else {
                Box::new(file)
            };

        let current_file_name = file_path
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_else(|| file_path.to_string_lossy().into_owned());

        let mut reader = pgn_reader::Reader::new(uncompressed);
        loop {
            let games_read = reader.read_games(&mut proc).take(10_000).count();
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

#[derive(Serialize, Type)]
pub struct DatabaseInfo {
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

    let path = file;

    let db_pool = get_duckdb_pool(&state, &path)?;
    let db = db_pool.get()?;

    let event_count = db.query_row("SELECT COUNT(DISTINCT event) FROM games;", [], |row| {
        row.get::<_, i32>(0)
    })?;

    let game_count = db.query_row("SELECT COUNT(*) FROM games;", [], |row| {
        row.get::<_, i32>(0)
    })?;

    let player_count = db.query_row(
        "SELECT COUNT(DISTINCT name) AS total_unique_names
            FROM (
                SELECT white AS name FROM games
                UNION ALL
                SELECT black AS name FROM games
            );",
        [],
        |row| row.get::<_, i32>(0),
    )?;

    let storage_size = path.metadata()?.len();
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

    clauses
}

fn build_game_order_clause(query_options: &QueryOptions<GameSort>) -> String {
    let dir = match query_options.direction {
        SortDirection::Asc => "ASC",
        SortDirection::Desc => "DESC",
    };

    let col = match query_options.sort {
        GameSort::Id => "rowid",
        GameSort::Date => "utc_timestamp",
        GameSort::WhiteElo => "white_rating",
        GameSort::BlackElo => "black_rating",
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

    let fen = row
        .get::<_, Option<String>>("fen")?
        .unwrap_or(Fen::default().to_string());

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
        moves: row.get("moves")?,
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
            CAST(rowid AS INTEGER) AS id,
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
            result,
            to_pgn(movedata) AS moves,
            ply_count
        FROM games
        {where_sql}
        {order_sql}
        {pagination_sql};"
    );
    println!("Data SQL: {data_sql}");

    let games = db
        .prepare(&data_sql)?
        .query_map([], |row| parse_normalized_game(row))?
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
    let db = db_pool.get()?;

    let mut where_clauses = vec!["name != 'Unknown'".to_string()];

    if let Some(name) = query.name.as_deref() {
        where_clauses.push(format!("name ILIKE '%{}%'", name.replace('\'', "''")));
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
        "WITH all_players AS (
            SELECT white AS name, MAX(white_rating) AS elo FROM games GROUP BY white
            UNION ALL
            SELECT black AS name, MAX(black_rating) AS elo FROM games GROUP BY black
        ), players AS (
            SELECT name, MAX(elo) AS elo FROM all_players GROUP BY name
        )
        SELECT name, elo
        FROM players
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
        let count_sql = format!(
            "WITH all_players AS (
                SELECT white AS name, MAX(white_rating) AS elo FROM games GROUP BY white
                UNION ALL
                SELECT black AS name, MAX(black_rating) AS elo FROM games GROUP BY black
            ), players AS (
                SELECT name, MAX(elo) AS elo FROM all_players GROUP BY name
            )
            SELECT COUNT(*) FROM players {where_sql};"
        );
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
        if !name.is_empty() {
            where_clauses.push(format!("name ILIKE '%{}%'", name.replace('\'', "''")));
        }
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
    pub opening: String,
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

fn detect_opening_from_moves(moves: &str) -> String {
    let mut chess = Chess::default();
    let mut setups = Vec::new();
    let mut variation_depth = 0usize;
    let mut comment_depth = 0usize;

    for token in moves.split_whitespace() {
        let open_comment = token.chars().filter(|&c| c == '{').count();
        let close_comment = token.chars().filter(|&c| c == '}').count();

        if comment_depth > 0 || open_comment > 0 {
            comment_depth = comment_depth.saturating_add(open_comment);
            comment_depth = comment_depth.saturating_sub(close_comment);
            continue;
        }

        let open_var = token.chars().filter(|&c| c == '(').count();
        let close_var = token.chars().filter(|&c| c == ')').count();
        let in_variation = variation_depth > 0 || open_var > 0;
        variation_depth = variation_depth.saturating_add(open_var);
        variation_depth = variation_depth.saturating_sub(close_var);
        if in_variation {
            continue;
        }

        if token == "1-0" || token == "0-1" || token == "1/2-1/2" || token == "*" {
            break;
        }

        if token.starts_with('$')
            || token.ends_with('.')
            || token == "..."
            || token.chars().all(|c| c.is_ascii_digit() || c == '.')
        {
            continue;
        }

        let sanitized = token.trim_end_matches(['!', '?']).trim();
        if sanitized.is_empty() {
            continue;
        }

        let Ok(san) = sanitized.parse::<San>() else {
            continue;
        };

        let Ok(chess_move) = san.to_move(&chess) else {
            break;
        };

        chess.play_unchecked(chess_move);
        setups.push(chess.clone().to_setup(EnPassantMode::Legal));

        if setups.len() > 54 {
            break;
        }
    }

    setups
        .into_iter()
        .rev()
        .find_map(|setup| get_opening_from_setup(setup).ok())
        .unwrap_or_default()
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

    type GameInfoRow = (
        String,
        String,
        Option<String>,
        Option<String>,
        Option<i32>,
        Option<i32>,
        Option<String>,
        String,
        String,
    );

    let sql = "SELECT
            white,
            black,
            result,
            strftime(utc_timestamp, '%Y-%m-%d') AS date,
            white_rating,
            black_rating,
            time_control,
            site,
            to_pgn(movedata) AS moves
        FROM games
        WHERE movedata IS NOT NULL";

    let info = db
        .prepare(sql)?
        .query_map([], |row| {
            Ok::<GameInfoRow, duckdb::Error>((
                row.get("white")?,
                row.get("black")?,
                row.get("result")?,
                row.get("date")?,
                row.get("white_rating")?,
                row.get("black_rating")?,
                row.get("time_control")?,
                row.get("site")?,
                row.get("moves")?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let total = info.len();
    if total == 0 {
        let _ = DatabaseProgress {
            id: player.clone(),
            progress: 100.0,
        }
        .emit(&app);
        return Ok(PlayerGameInfo::default());
    }

    let mut grouped: HashMap<(String, String), Vec<StatsData>> = HashMap::new();

    for (index, (white, black, outcome, date, white_elo, black_elo, time_control, site, moves)) in
        info.into_iter().enumerate()
    {
        let Some(outcome) = outcome else {
            continue;
        };
        let Some(date) = date else {
            continue;
        };

        let site = normalize_site_name(site.as_str());
        let opening = detect_opening_from_moves(moves.as_str());
        let time_control = time_control.unwrap_or_default();

        if let (Some(elo), Some(result)) =
            (white_elo, GameOutcome::from_str(outcome.as_str(), true))
        {
            grouped
                .entry((site.clone(), white.clone()))
                .or_default()
                .push(StatsData {
                    date: date.clone(),
                    is_player_white: true,
                    player_elo: elo,
                    result,
                    time_control: time_control.clone(),
                    opening: opening.clone(),
                });
        }

        if let (Some(elo), Some(result)) =
            (black_elo, GameOutcome::from_str(outcome.as_str(), false))
        {
            grouped
                .entry((site.clone(), black.clone()))
                .or_default()
                .push(StatsData {
                    date: date.clone(),
                    is_player_white: false,
                    player_elo: elo,
                    result,
                    time_control: time_control.clone(),
                    opening: opening.clone(),
                });
        }

        if index.is_multiple_of(1000) || index + 1 == total {
            let _ = DatabaseProgress {
                id: player.clone(),
                progress: ((index + 1) as f64 / total as f64) * 100.0,
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
pub async fn delete_duplicated_games(
    file: PathBuf,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let db_pool = get_duckdb_pool(&state, &file)?;
    let db = db_pool.get()?;

    db.execute_batch(
        "
        DELETE FROM games
        WHERE rowid IN (
            SELECT rowid
            FROM (
                SELECT rowid,
                    ROW_NUMBER() OVER (
                        PARTITION BY event, site, round, white, black, movedata, utc_timestamp
                        ORDER BY rowid
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

    db.execute("DELETE FROM games WHERE ply_count = 0;", [])?;

    Ok(())
}

struct PgnGame {
    event: Option<String>,
    site: Option<String>,
    date: Option<String>,
    round: Option<String>,
    white: Option<String>,
    black: Option<String>,
    result: Option<String>,
    time_control: Option<String>,
    eco: Option<String>,
    white_elo: Option<String>,
    black_elo: Option<String>,
    ply_count: Option<String>,
    fen: Option<String>,
    moves: Option<String>,
}

impl PgnGame {
    fn write(&self, writer: &mut impl Write) -> Result<(), Error> {
        writeln!(
            writer,
            "[Event \"{}\"]",
            self.event.as_deref().unwrap_or("")
        )?;
        writeln!(writer, "[Site \"{}\"]", self.site.as_deref().unwrap_or(""))?;
        writeln!(writer, "[Date \"{}\"]", self.date.as_deref().unwrap_or(""))?;
        writeln!(
            writer,
            "[Round \"{}\"]",
            self.round.as_deref().unwrap_or("")
        )?;
        writeln!(
            writer,
            "[White \"{}\"]",
            self.white.as_deref().unwrap_or("")
        )?;
        writeln!(
            writer,
            "[Black \"{}\"]",
            self.black.as_deref().unwrap_or("")
        )?;
        writeln!(
            writer,
            "[Result \"{}\"]",
            self.result.as_deref().unwrap_or("*")
        )?;
        if let Some(time_control) = self.time_control.as_deref() {
            writeln!(writer, "[TimeControl \"{}\"]", time_control)?;
        }
        if let Some(eco) = self.eco.as_deref() {
            writeln!(writer, "[ECO \"{}\"]", eco)?;
        }
        if let Some(white_elo) = self.white_elo.as_deref() {
            if white_elo == "0" {
                writeln!(writer, "[WhiteElo \"-\"]")?;
            } else {
                writeln!(writer, "[WhiteElo \"{}\"]", white_elo)?;
            }
        }
        if let Some(black_elo) = self.black_elo.as_deref() {
            if black_elo == "0" {
                writeln!(writer, "[BlackElo \"-\"]")?;
            } else {
                writeln!(writer, "[BlackElo \"{}\"]", black_elo)?;
            }
        }
        if let Some(ply_count) = self.ply_count.as_deref() {
            writeln!(writer, "[PlyCount \"{}\"]", ply_count)?;
        }
        if let Some(fen) = self.fen.as_deref() {
            writeln!(writer, "[SetUp \"1\"]")?;
            writeln!(writer, "[FEN \"{}\"]", fen)?;
        }
        writeln!(writer)?;
        if let Some(moves) = self.moves.as_deref() {
            if !moves.is_empty() {
                write!(writer, "{} ", moves)?;
            }
        }
        match self.result.as_deref() {
            Some("1-0") => writeln!(writer, "1-0"),
            Some("0-1") => writeln!(writer, "0-1"),
            Some("1/2-1/2") => writeln!(writer, "1/2-1/2"),
            _ => writeln!(writer, "*"),
        }?;
        writeln!(writer)?;
        Ok(())
    }
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
        "SELECT
            event,
            site,
            strftime(utc_timestamp, '%Y.%m.%d') AS date,
            round,
            white,
            black,
            result,
            white_rating,
            black_rating,
            ply_count,
            fen,
            to_pgn(movedata) AS moves
        FROM games;",
    )?;

    let rows = statement.query_map([], |row| {
        Ok(PgnGame {
            event: row.get("event")?,
            site: row.get("site")?,
            date: row.get("date")?,
            round: row.get("round")?,
            white: row.get("white")?,
            black: row.get("black")?,
            result: row.get("result")?,
            time_control: row.get("timecontrol")?,
            eco: row.get("eco")?,
            white_elo: row
                .get::<_, Option<i32>>("white_rating")?
                .map(|v| v.to_string()),
            black_elo: row
                .get::<_, Option<i32>>("black_rating")?
                .map(|v| v.to_string()),
            ply_count: row
                .get::<_, Option<i32>>("ply_count")?
                .map(|v| v.to_string()),
            fen: row.get("fen")?,
            moves: row.get("moves")?,
        })
    })?;

    for row in rows {
        row?.write(&mut writer)?;
    }

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

    db.execute("DELETE FROM games WHERE rowid = ?;", params![game_id])?;

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

    let movedata = pgn::encode_single_game_moves(pgn.as_str(), AixCompressionLevel::Low, false)
        .map_err(|msg| std::io::Error::new(std::io::ErrorKind::InvalidData, msg))?;

    if !movedata.is_empty() {
        db.execute(
            "UPDATE games SET movedata = ? WHERE rowid = ?;",
            params![movedata, game_id],
        )?;
    } else {
        return Err(Error::Io(Box::new(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Failed to parse PGN",
        ))));
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

    db.execute(
        "UPDATE games SET white = ? WHERE white = ?;",
        params![player1_name, player2_name],
    )?;

    db.execute(
        "UPDATE games SET black = ? WHERE black = ?;",
        params![player1_name, player2_name],
    )?;

    Ok(())
}
