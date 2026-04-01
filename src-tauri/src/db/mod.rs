mod encoding;
mod models;
mod schema;
mod search;

use crate::{
    db::{encoding::decode_move, models::*},
    error::Error,
    AppState,
};
use aix_chess_compression::{
    CompressionLevel as AixCompressionLevel, Encode as AixEncode, Encoder as AixEncoder,
};
use chrono::{NaiveDate, NaiveTime};
use dashmap::mapref::entry::Entry;
use duckdb::{params, AccessMode, Config, Connection, DuckdbConnectionManager};
use pgn_reader::{RawTag, Reader, SanPlus, Skip, Visitor};
use r2d2::Pool;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use shakmaty::{
    fen::Fen, Board, ByColor, CastlingMode, Chess, EnPassantMode, FromSetup, Piece, Position,
    PositionError,
};
use specta::Type;
use std::{
    fs::{remove_file, File, OpenOptions},
    ops::ControlFlow,
    path::{Path, PathBuf},
    time::Instant,
};
use std::{
    io::{BufWriter, Write},
    str::FromStr,
};
use tauri::Emitter;

use log::info;
use tauri_specta::Event as _;

pub use self::models::NormalizedGame;
pub use self::models::Puzzle;
pub use self::schema::puzzle_themes;
pub use self::schema::puzzles;
pub use self::schema::themes;
pub use self::search::{is_position_in_db, search_position, PositionQueryJs, PositionStats};

const DEFAULT_AIXCHESS_EXTENSION_PATH: &str =
    "/home/fbsal/dev/aix/build/release/extension/aixchess/aixchess.duckdb_extension";

fn sql_literal(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

pub fn create_duckdb_pool(path: &Path) -> Result<Pool<DuckdbConnectionManager>, Error> {
    let config = Config::default()
        .allow_unsigned_extensions()?
        .access_mode(AccessMode::ReadWrite)?;
    let manager = DuckdbConnectionManager::file_with_flags(path, config)?;
    let pool = Pool::builder().build(manager)?;
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

    let pool = create_duckdb_pool(path)?;
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

pub fn load_aixchess_extension(connection: &Connection) -> Result<(), Error> {
    let extension_path = std::env::var("AIXCHESS_EXTENSION_PATH")
        .unwrap_or_else(|_| DEFAULT_AIXCHESS_EXTENSION_PATH.to_string());

    if !Path::new(&extension_path).exists() {
        return Err(Error::Io(Box::new(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("aixchess extension not found at: {extension_path}"),
        ))));
    }

    let load_local_sql = format!("LOAD {};", sql_literal(&extension_path));
    connection.execute_batch(&load_local_sql)?;
    info!("Loaded local unsigned aixchess extension from: {extension_path}");
    Ok(())
}

const WHITE_PAWN: Piece = Piece {
    color: shakmaty::Color::White,
    role: shakmaty::Role::Pawn,
};

const BLACK_PAWN: Piece = Piece {
    color: shakmaty::Color::Black,
    role: shakmaty::Role::Pawn,
};

type MaterialCount = ByColor<u8>;

fn get_material_count(board: &Board) -> MaterialCount {
    board.material().map(|material| {
        material.pawn
            + material.knight * 3
            + material.bishop * 3
            + material.rook * 5
            + material.queen * 9
    })
}

/// Returns the bit representation of the pawns on the second and seventh rank
/// of the given board.
fn get_pawn_home(board: &Board) -> u16 {
    let white_pawns = board.by_piece(WHITE_PAWN);
    let black_pawns = board.by_piece(BLACK_PAWN);
    let second_rank_pawns = (white_pawns.0 >> 8) as u8;
    let seventh_rank_pawns = (black_pawns.0 >> 48) as u8;
    (second_rank_pawns as u16) | ((seventh_rank_pawns as u16) << 8)
}

#[derive(Default, Debug, Clone)]
struct AixTags {
    event: Option<String>,
    site: Option<String>,
    date: Option<String>,
    utctime: Option<String>,
    round: Option<String>,
    white: Option<String>,
    black: Option<String>,
    whiteelo: Option<i32>,
    blackelo: Option<i32>,
    result: Option<String>,
    timecontrol: Option<String>,
    eco: Option<String>,
    setup: bool,
    fen: Option<String>,
}

#[derive(Debug)]
struct AixGameRow {
    event: String,
    site: String,
    date: Option<String>,
    utctime: Option<String>,
    round: Option<String>,
    white: String,
    black: String,
    whiteelo: Option<i32>,
    blackelo: Option<i32>,
    result: Option<String>,
    timecontrol: Option<String>,
    eco: Option<String>,
    movedata: Vec<u8>,
    ply_count: u16,
}

struct AixGameInProgress {
    tags: AixTags,
    encoder: AixEncoder<'static>,
    position: Chess,
    ply_count: u16,
    position_stack: Vec<(Chess, u16)>,
    position_before_last_move: Option<Chess>,
    ply_before_last_move: u16,
}

struct AixImporter {
    tags: AixTags,
    game: Option<AixGameInProgress>,
    timestamp: Option<i64>,
    skip: bool,
}

impl AixImporter {
    fn new(timestamp: Option<i64>) -> Self {
        Self {
            tags: AixTags::default(),
            game: None,
            timestamp,
            skip: false,
        }
    }

    fn should_skip_by_timestamp(tags: &AixTags, timestamp: Option<i64>) -> bool {
        let Some(timestamp) = timestamp else {
            return false;
        };

        let Some(date) = tags.date.as_deref() else {
            return false;
        };

        let Some(time) = tags.utctime.as_deref() else {
            return false;
        };

        let Some(parsed_date) = NaiveDate::parse_from_str(date, "%Y.%m.%d").ok() else {
            return false;
        };
        let Some(parsed_time) = NaiveTime::parse_from_str(time, "%H:%M:%S").ok() else {
            return false;
        };

        parsed_date.and_time(parsed_time).and_utc().timestamp() <= timestamp
    }

    fn position_from_tags(tags: &AixTags) -> Result<(Chess, Option<String>), ()> {
        let initial_fen = if tags.setup { tags.fen.clone() } else { None };

        let position = match initial_fen.as_deref() {
            Some(fen) => {
                let fen = Fen::from_ascii(fen.as_bytes()).map_err(|_| ())?;
                let setup = fen.into_setup();
                let castling_mode = CastlingMode::detect(&setup);
                Chess::from_setup(setup, castling_mode)
                    .or_else(PositionError::ignore_too_much_material)
                    .map_err(|_| ())?
            }
            None => Chess::new(),
        };

        Ok((position, initial_fen))
    }
}

impl Visitor for AixImporter {
    type Tags = ();
    type Movetext = ();
    type Output = Option<AixGameRow>;

    fn begin_tags(&mut self) -> ControlFlow<Self::Output, Self::Tags> {
        self.tags = AixTags::default();
        self.game = None;
        self.skip = false;
        ControlFlow::Continue(())
    }

    fn tag(
        &mut self,
        _tags: &mut Self::Tags,
        key: &[u8],
        value: RawTag<'_>,
    ) -> ControlFlow<Self::Output> {
        let value = value.decode_utf8_lossy().into_owned();
        match key {
            b"Event" => self.tags.event = Some(value),
            b"Site" => self.tags.site = Some(value),
            b"Date" | b"UTCDate" => self.tags.date = Some(value),
            b"UTCTime" => self.tags.utctime = Some(value),
            b"Round" => self.tags.round = Some(value),
            b"White" => self.tags.white = Some(value),
            b"Black" => self.tags.black = Some(value),
            b"WhiteElo" => {
                self.tags.whiteelo = if value == "-" {
                    Some(0)
                } else {
                    value.parse().ok()
                }
            }
            b"BlackElo" => {
                self.tags.blackelo = if value == "-" {
                    Some(0)
                } else {
                    value.parse().ok()
                }
            }
            b"Result" => self.tags.result = Some(value),
            b"TimeControl" => self.tags.timecontrol = Some(value),
            b"ECO" => self.tags.eco = Some(value),
            b"SetUp" => self.tags.setup = value == "1",
            b"FEN" => self.tags.fen = Some(value),
            _ => {}
        }

        ControlFlow::Continue(())
    }

    fn begin_movetext(&mut self, _tags: Self::Tags) -> ControlFlow<Self::Output, Self::Movetext> {
        if Self::should_skip_by_timestamp(&self.tags, self.timestamp) {
            self.skip = true;
            return ControlFlow::Continue(());
        }

        let Ok((position, initial_fen)) = Self::position_from_tags(&self.tags) else {
            self.skip = true;
            return ControlFlow::Continue(());
        };

        let Ok(encoder) =
            AixEncoder::new_with_initial_fen(AixCompressionLevel::Low, initial_fen.as_deref())
        else {
            self.skip = true;
            return ControlFlow::Continue(());
        };

        self.game = Some(AixGameInProgress {
            tags: self.tags.clone(),
            encoder,
            position,
            ply_count: 0,
            position_stack: Vec::new(),
            position_before_last_move: None,
            ply_before_last_move: 0,
        });

        ControlFlow::Continue(())
    }

    fn san(&mut self, _movetext: &mut Self::Movetext, san: SanPlus) -> ControlFlow<Self::Output> {
        if self.skip {
            return ControlFlow::Continue(());
        }

        let Some(game) = self.game.as_mut() else {
            self.skip = true;
            return ControlFlow::Continue(());
        };

        match san.san.to_move(&game.position) {
            Ok(chess_move) => {
                game.position_before_last_move = Some(game.position.clone());
                game.ply_before_last_move = game.ply_count;
                if game.encoder.encode_move(chess_move).is_err() {
                    self.skip = true;
                    return ControlFlow::Continue(());
                }
                game.position.play_unchecked(chess_move);
                game.ply_count += 1;
            }
            Err(_) => {
                self.skip = true;
            }
        }

        ControlFlow::Continue(())
    }

    fn begin_variation(
        &mut self,
        _movetext: &mut Self::Movetext,
    ) -> ControlFlow<Self::Output, Skip> {
        if self.skip {
            return ControlFlow::Continue(Skip(true));
        }

        let Some(game) = self.game.as_mut() else {
            self.skip = true;
            return ControlFlow::Continue(Skip(true));
        };

        game.encoder.encode_start_variation();
        game.position_stack
            .push((game.position.clone(), game.ply_count));

        if let Some(previous_position) = game.position_before_last_move.as_ref() {
            game.position = previous_position.clone();
            game.ply_count = game.ply_before_last_move;
        }

        ControlFlow::Continue(Skip(false))
    }

    fn end_variation(&mut self, _movetext: &mut Self::Movetext) -> ControlFlow<Self::Output> {
        if self.skip {
            return ControlFlow::Continue(());
        }

        let Some(game) = self.game.as_mut() else {
            self.skip = true;
            return ControlFlow::Continue(());
        };

        game.encoder.encode_end_variation();
        if let Some((position, ply_count)) = game.position_stack.pop() {
            game.position = position;
            game.ply_count = ply_count;
        } else {
            self.skip = true;
        }

        ControlFlow::Continue(())
    }

    fn end_game(&mut self, _movetext: Self::Movetext) -> Self::Output {
        if self.skip {
            self.tags = AixTags::default();
            self.game = None;
            return None;
        }

        let Some(game) = self.game.take() else {
            return None;
        };

        let movedata = game.encoder.finish().into_bytes();
        Some(AixGameRow {
            event: game.tags.event.unwrap_or_else(|| "Unknown".to_string()),
            site: game.tags.site.unwrap_or_else(|| "Unknown".to_string()),
            date: game.tags.date,
            utctime: game.tags.utctime,
            round: game.tags.round,
            white: game.tags.white.unwrap_or_else(|| "Unknown".to_string()),
            black: game.tags.black.unwrap_or_else(|| "Unknown".to_string()),
            whiteelo: game.tags.whiteelo,
            blackelo: game.tags.blackelo,
            result: game.tags.result,
            timecontrol: game.tags.timecontrol,
            eco: game.tags.eco,
            movedata,
            ply_count: game.ply_count,
        })
    }
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
        db.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS games (
                event VARCHAR,
                site VARCHAR,
                date VARCHAR,
                utctime VARCHAR,
                round VARCHAR,
                white VARCHAR,
                black VARCHAR,
                whiteelo INTEGER,
                blackelo INTEGER,
                result VARCHAR,
                timecontrol VARCHAR,
                eco VARCHAR,
                movedata BLOB,
                ply_count USMALLINT
            );
            ",
        )?;
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
    let mut imported_games = 0usize;
    let ts = timestamp.map(i64::from);
    let mut appender = db.appender("games")?;

    for file_path in files {
        let current_file_name = file_path
            .file_name()
            .map(|name| name.to_string_lossy().into_owned());

        let extension = file_path.extension().and_then(|ext| ext.to_str());
        let file = File::open(&file_path)?;

        let uncompressed: Box<dyn std::io::Read + Send> = if extension == Some("bz2") {
            Box::new(bzip2::read::MultiBzDecoder::new(file))
        } else if extension == Some("zst") {
            Box::new(zstd::Decoder::new(file)?)
        } else {
            Box::new(file)
        };

        let mut importer = AixImporter::new(ts);
        let mut reader = Reader::new(uncompressed);
        while let Some(game) = reader.read_game(&mut importer)? {
            let Some(game) = game else {
                continue;
            };

            appender.append_row(params![
                game.event,
                game.site,
                game.date,
                game.utctime,
                game.round,
                game.white,
                game.black,
                game.whiteelo,
                game.blackelo,
                game.result,
                game.timecontrol,
                game.eco,
                game.movedata,
                game.ply_count,
            ])?;

            imported_games += 1;
            if imported_games.is_multiple_of(1000) {
                let elapsed = start.elapsed().as_millis() as u32;
                let _ = app.emit(
                    "convert_progress",
                    (imported_games, elapsed, current_file_name.clone()),
                );
            }
        }
    }

    appender.flush()?;
    db.execute("CHECKPOINT", [])?;

    let elapsed = start.elapsed().as_millis() as u32;
    let _ = app.emit(
        "convert_progress",
        (imported_games, elapsed, Option::<String>::None),
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
    pub player1: Option<i32>,
    #[specta(optional)]
    pub player2: Option<i32>,
    #[specta(optional)]
    pub tournament_id: Option<i32>,
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

#[tauri::command]
#[specta::specta]
pub async fn get_games(
    file: PathBuf,
    query: GameQuery,
    state: tauri::State<'_, AppState>,
) -> Result<QueryResponse<Vec<NormalizedGame>>, Error> {
    let db_pool = get_duckdb_pool(&state, &file)?;
    let db = db_pool.get()?;
    load_aixchess_extension(&db)?;
    let count = db.query_row("SELECT COUNT(*) FROM games;", [], |row| {
        row.get::<_, i32>(0)
    })?;
    let games = db
        .prepare(
            "SELECT
            row_number() OVER () AS id,
            event,
            site,
            date,
            utctime,
            round,
            white,
            black,
            whiteelo,
            blackelo,
            result,
            timecontrol,
            eco,
            to_pgn(movedata) AS moves,
            ply_count
        FROM games
        LIMIT 5;",
        )?
        .query_map([], |row| {
            let result = match row.get::<_, Option<String>>("result")?.as_deref() {
                Some("1-0") => Outcome::WhiteWin,
                Some("0-1") => Outcome::BlackWin,
                Some("1/2-1/2") => Outcome::Draw,
                _ => Outcome::Unknown,
            };

            Ok(NormalizedGame {
                id: row.get("id")?,
                event: row.get("event")?,
                white: row.get("white")?,
                black: row.get("black")?,
                white_elo: row.get("whiteelo")?,
                black_elo: row.get("blackelo")?,
                date: row.get("date")?,
                time: row.get("utctime")?,
                time_control: row.get("timecontrol")?,
                eco: row.get("eco")?,
                fen: "".to_string(),
                moves: row.get("moves")?,
                result,
                ply_count: row.get("ply_count")?,
                round: row.get("round")?,
                site: row.get("site")?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    // let mut count: Option<i64> = None;
    // let query_options = query.options.unwrap_or_default();

    // let (white_players, black_players) = diesel::alias!(players as white, players as black);
    // let mut sql_query = games::table
    //     .inner_join(white_players.on(games::white_id.eq(white_players.field(players::id))))
    //     .inner_join(black_players.on(games::black_id.eq(black_players.field(players::id))))
    //     .inner_join(events::table.on(games::event_id.eq(events::id)))
    //     .inner_join(sites::table.on(games::site_id.eq(sites::id)))
    //     .into_boxed();
    // let mut count_query = games::table.into_boxed();

    // // if let Some(speed) = query.speed {
    // //     sql_query = sql_query.filter(games::speed.eq(speed as i32));
    // //     count_query = count_query.filter(games::speed.eq(speed as i32));
    // // }

    // if let Some(outcome) = query.outcome {
    //     sql_query = sql_query.filter(games::result.eq(outcome.clone()));
    //     count_query = count_query.filter(games::result.eq(outcome));
    // }

    // if let Some(start_date) = query.start_date {
    //     sql_query = sql_query.filter(games::date.ge(start_date.clone()));
    //     count_query = count_query.filter(games::date.ge(start_date));
    // }

    // if let Some(end_date) = query.end_date {
    //     sql_query = sql_query.filter(games::date.le(end_date.clone()));
    //     count_query = count_query.filter(games::date.le(end_date));
    // }

    // if let Some(tournament_id) = query.tournament_id {
    //     sql_query = sql_query.filter(games::event_id.eq(tournament_id));
    //     count_query = count_query.filter(games::event_id.eq(tournament_id));
    // }

    // if let Some(limit) = query_options.page_size {
    //     sql_query = sql_query.limit(limit as i64);
    // }

    // if let Some(page) = query_options.page {
    //     sql_query = sql_query.offset(((page - 1) * query_options.page_size.unwrap_or(10)) as i64);
    // }

    // match query.sides {
    //     Some(Sides::BlackWhite) => {
    //         if let Some(player1) = query.player1 {
    //             sql_query = sql_query.filter(games::black_id.eq(player1));
    //             count_query = count_query.filter(games::black_id.eq(player1));
    //         }
    //         if let Some(player2) = query.player2 {
    //             sql_query = sql_query.filter(games::white_id.eq(player2));
    //             count_query = count_query.filter(games::white_id.eq(player2));
    //         }

    //         if let Some(range1) = query.range1 {
    //             sql_query = sql_query.filter(games::black_elo.between(range1.0, range1.1));
    //             count_query = count_query.filter(games::black_elo.between(range1.0, range1.1));
    //         }

    //         if let Some(range2) = query.range2 {
    //             sql_query = sql_query.filter(games::white_elo.between(range2.0, range2.1));
    //             count_query = count_query.filter(games::white_elo.between(range2.0, range2.1));
    //         }
    //     }
    //     Some(Sides::WhiteBlack) => {
    //         if let Some(player1) = query.player1 {
    //             sql_query = sql_query.filter(games::white_id.eq(player1));
    //             count_query = count_query.filter(games::white_id.eq(player1));
    //         }
    //         if let Some(player2) = query.player2 {
    //             sql_query = sql_query.filter(games::black_id.eq(player2));
    //             count_query = count_query.filter(games::black_id.eq(player2));
    //         }

    //         if let Some(range1) = query.range1 {
    //             sql_query = sql_query.filter(games::white_elo.between(range1.0, range1.1));
    //             count_query = count_query.filter(games::white_elo.between(range1.0, range1.1));
    //         }

    //         if let Some(range2) = query.range2 {
    //             sql_query = sql_query.filter(games::black_elo.between(range2.0, range2.1));
    //             count_query = count_query.filter(games::black_elo.between(range2.0, range2.1));
    //         }
    //     }
    //     Some(Sides::Any) => {
    //         if let Some(player1) = query.player1 {
    //             sql_query =
    //                 sql_query.filter(games::white_id.eq(player1).or(games::black_id.eq(player1)));
    //             count_query =
    //                 count_query.filter(games::white_id.eq(player1).or(games::black_id.eq(player1)));
    //         }
    //         if let Some(player2) = query.player2 {
    //             sql_query =
    //                 sql_query.filter(games::white_id.eq(player2).or(games::black_id.eq(player2)));
    //             count_query =
    //                 count_query.filter(games::white_id.eq(player2).or(games::black_id.eq(player2)));
    //         }

    //         if let (Some(range1), Some(range2)) = (query.range1, query.range2) {
    //             sql_query = sql_query.filter(
    //                 games::white_elo
    //                     .between(range1.0, range1.1)
    //                     .or(games::black_elo.between(range1.0, range1.1))
    //                     .or(games::white_elo
    //                         .between(range2.0, range2.1)
    //                         .or(games::black_elo.between(range2.0, range2.1))),
    //             );
    //             count_query = count_query.filter(
    //                 games::white_elo
    //                     .between(range1.0, range1.1)
    //                     .or(games::black_elo.between(range1.0, range1.1))
    //                     .or(games::white_elo
    //                         .between(range2.0, range2.1)
    //                         .or(games::black_elo.between(range2.0, range2.1))),
    //             );
    //         } else {
    //             if let Some(range1) = query.range1 {
    //                 sql_query = sql_query.filter(
    //                     games::white_elo
    //                         .between(range1.0, range1.1)
    //                         .or(games::black_elo.between(range1.0, range1.1)),
    //                 );
    //                 count_query = count_query.filter(
    //                     games::white_elo
    //                         .between(range1.0, range1.1)
    //                         .or(games::black_elo.between(range1.0, range1.1)),
    //                 );
    //             }

    //             if let Some(range2) = query.range2 {
    //                 sql_query = sql_query.filter(
    //                     games::white_elo
    //                         .between(range2.0, range2.1)
    //                         .or(games::black_elo.between(range2.0, range2.1)),
    //                 );
    //                 count_query = count_query.filter(
    //                     games::white_elo
    //                         .between(range2.0, range2.1)
    //                         .or(games::black_elo.between(range2.0, range2.1)),
    //                 );
    //             }
    //         }
    //     }
    //     None => {}
    // }

    // sql_query = match query_options.sort {
    //     GameSort::Id => match query_options.direction {
    //         SortDirection::Asc => sql_query.order(games::id.asc()),
    //         SortDirection::Desc => sql_query.order(games::id.desc()),
    //     },
    //     GameSort::Date => match query_options.direction {
    //         SortDirection::Asc => sql_query.order((games::date.asc(), games::time.asc())),
    //         SortDirection::Desc => sql_query.order((games::date.desc(), games::time.desc())),
    //     },
    //     GameSort::WhiteElo => match query_options.direction {
    //         SortDirection::Asc => sql_query.order(games::white_elo.asc()),
    //         SortDirection::Desc => sql_query.order(games::white_elo.desc()),
    //     },
    //     GameSort::BlackElo => match query_options.direction {
    //         SortDirection::Asc => sql_query.order(games::black_elo.asc()),
    //         SortDirection::Desc => sql_query.order(games::black_elo.desc()),
    //     },
    //     GameSort::PlyCount => match query_options.direction {
    //         SortDirection::Asc => sql_query.order(games::ply_count.asc()),
    //         SortDirection::Desc => sql_query.order(games::ply_count.desc()),
    //     },
    // };

    // if !query_options.skip_count {
    //     count = Some(
    //         count_query
    //             .select(diesel::dsl::count(games::id))
    //             .first(db)?,
    //     );
    // }

    // // println!(
    // //     "{:?}\n",
    // //     diesel::debug_query::<diesel::sqlite::Sqlite, _>(&sql_query)
    // // );

    // let games: Vec<(Game, Player, Player, Event, Site)> = sql_query.load(db)?;
    // let normalized_games = normalize_games(games);

    // Ok(QueryResponse {
    //     data: normalized_games,
    //     count: count.map(|c| c as i32),
    // })
    Ok(QueryResponse {
        data: games,
        count: Some(count),
    })
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
    #[serde(rename = "id")]
    Id,
    #[serde(rename = "name")]
    Name,
    #[serde(rename = "elo")]
    Elo,
}

#[tauri::command]
#[specta::specta]
pub async fn get_player(
    file: PathBuf,
    id: i32,
    state: tauri::State<'_, AppState>,
) -> Result<Option<Player>, Error> {
    // let db = &mut get_db_or_create(&state, file.to_str().unwrap(), ConnectionOptions::default())?;
    // let player = players::table
    //     .filter(players::id.eq(id))
    //     .first::<Player>(db)
    //     .optional()?;
    // Ok(player)
    Ok(None)
}

#[tauri::command]
#[specta::specta]
pub async fn get_players(
    file: PathBuf,
    query: PlayerQuery,
    state: tauri::State<'_, AppState>,
) -> Result<QueryResponse<Vec<Player>>, Error> {
    // let db = &mut get_db_or_create(&state, file.to_str().unwrap(), ConnectionOptions::default())?;
    // let mut count: Option<i64> = None;

    // let mut sql_query = players::table.into_boxed();
    // let mut count_query = players::table.into_boxed();
    // sql_query = sql_query.filter(players::name.is_not("Unknown"));
    // count_query = count_query.filter(players::name.is_not("Unknown"));

    // if let Some(name) = query.name {
    //     sql_query = sql_query.filter(players::name.like(format!("%{}%", name)));
    //     count_query = count_query.filter(players::name.like(format!("%{}%", name)));
    // }

    // if let Some(range) = query.range {
    //     sql_query = sql_query.filter(players::elo.between(range.0, range.1));
    //     count_query = count_query.filter(players::elo.between(range.0, range.1));
    // }

    // if !query.options.skip_count {
    //     count = Some(count_query.count().get_result(db)?);
    // }

    // if let Some(limit) = query.options.page_size {
    //     sql_query = sql_query.limit(limit as i64);
    // }

    // if let Some(page) = query.options.page {
    //     sql_query = sql_query.offset(((page - 1) * query.options.page_size.unwrap_or(10)) as i64);
    // }

    // sql_query = match query.options.sort {
    //     PlayerSort::Id => match query.options.direction {
    //         SortDirection::Asc => sql_query.order(players::id.asc()),
    //         SortDirection::Desc => sql_query.order(players::id.desc()),
    //     },
    //     PlayerSort::Name => match query.options.direction {
    //         SortDirection::Asc => sql_query.order(players::name.asc()),
    //         SortDirection::Desc => sql_query.order(players::name.desc()),
    //     },
    //     PlayerSort::Elo => match query.options.direction {
    //         SortDirection::Asc => sql_query.order(players::elo.asc()),
    //         SortDirection::Desc => sql_query.order(players::elo.desc()),
    //     },
    // };

    // let players = sql_query.load::<Player>(db)?;

    // Ok(QueryResponse {
    //     data: players,
    //     count: count.map(|c| c as i32),
    // })
    Ok(QueryResponse {
        data: Vec::new(),
        count: Some(0),
    })
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub enum TournamentSort {
    #[serde(rename = "id")]
    Id,
    #[serde(rename = "name")]
    Name,
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
    // let db = &mut get_db_or_create(&state, file.to_str().unwrap(), ConnectionOptions::default())?;
    // let mut count: Option<i64> = None;

    // let mut sql_query = events::table.into_boxed();
    // let mut count_query = events::table.into_boxed();
    // sql_query = sql_query.filter(events::name.is_not("Unknown").and(events::name.is_not("")));
    // count_query = count_query.filter(events::name.is_not("Unknown").and(events::name.is_not("")));

    // if let Some(name) = query.name {
    //     sql_query = sql_query.filter(events::name.like(format!("%{}%", name)));
    //     count_query = count_query.filter(events::name.like(format!("%{}%", name)));
    // }

    // if !query.options.skip_count {
    //     count = Some(count_query.count().get_result(db)?);
    // }

    // if let Some(limit) = query.options.page_size {
    //     sql_query = sql_query.limit(limit as i64);
    // }

    // if let Some(page) = query.options.page {
    //     sql_query = sql_query.offset(((page - 1) * query.options.page_size.unwrap_or(10)) as i64);
    // }

    // sql_query = match query.options.sort {
    //     TournamentSort::Id => match query.options.direction {
    //         SortDirection::Asc => sql_query.order(events::id.asc()),
    //         SortDirection::Desc => sql_query.order(events::id.desc()),
    //     },
    //     TournamentSort::Name => match query.options.direction {
    //         SortDirection::Asc => sql_query.order(events::name.asc()),
    //         SortDirection::Desc => sql_query.order(events::name.desc()),
    //     },
    // };

    // let events = sql_query.load::<Event>(db)?;

    // Ok(QueryResponse {
    //     data: events,
    //     count: count.map(|c| c as i32),
    // })
    Ok(QueryResponse {
        data: Vec::new(),
        count: Some(0),
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

#[tauri::command]
#[specta::specta]
pub async fn get_players_game_info(
    file: PathBuf,
    id: i32,
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<PlayerGameInfo, Error> {
    // let db = &mut get_db_or_create(&state, file.to_str().unwrap(), ConnectionOptions::default())?;
    // let timer = Instant::now();

    // let sql_query = games::table
    //     .inner_join(sites::table.on(games::site_id.eq(sites::id)))
    //     .inner_join(players::table.on(players::id.eq(id)))
    //     .select((
    //         games::white_id,
    //         games::black_id,
    //         games::result,
    //         games::date,
    //         games::moves,
    //         games::white_elo,
    //         games::black_elo,
    //         games::time_control,
    //         sites::name,
    //         players::name,
    //     ))
    //     .filter(games::white_id.eq(id).or(games::black_id.eq(id)))
    //     .filter(games::fen.is_null());

    // type GameInfo = (
    //     i32,
    //     i32,
    //     Option<String>,
    //     Option<String>,
    //     Vec<u8>,
    //     Option<i32>,
    //     Option<i32>,
    //     Option<String>,
    //     Option<String>,
    //     Option<String>,
    // );
    // let info: Vec<GameInfo> = sql_query.load(db)?;

    // let mut game_info = PlayerGameInfo::default();
    // let progress = AtomicUsize::new(0);
    // game_info.site_stats_data = info
    //     .par_iter()
    //     .filter_map(
    //         |(
    //             white_id,
    //             black_id,
    //             outcome,
    //             date,
    //             moves,
    //             white_elo,
    //             black_elo,
    //             time_control,
    //             site,
    //             player,
    //         )| {
    //             let is_white = *white_id == id;
    //             let is_black = *black_id == id;
    //             let result = GameOutcome::from_str(outcome.as_deref()?, is_white);

    //             if !is_white && !is_black
    //                 || is_white && white_elo.is_none()
    //                 || is_black && black_elo.is_none()
    //                 || result.is_none()
    //                 || date.is_none()
    //                 || site.is_none()
    //                 || player.is_none()
    //             {
    //                 return None;
    //             }

    //             let site = site.as_deref().map(|s| {
    //                 if s.starts_with("https://lichess.org/") {
    //                     "Lichess".to_string()
    //                 } else {
    //                     s.to_string()
    //                 }
    //             })?;

    //             let mut setups = vec![];
    //             let mut chess = Chess::default();
    //             for (i, byte) in iter_mainline_move_bytes(moves).enumerate() {
    //                 if i > 54 {
    //                     // max length of opening in data
    //                     break;
    //                 }
    //                 let Some(m) = decode_move(byte, &chess) else {
    //                     break;
    //                 };
    //                 chess.play_unchecked(&m);
    //                 setups.push(chess.clone().into_setup(EnPassantMode::Legal));
    //             }

    //             setups.reverse();
    //             let opening = setups
    //                 .iter()
    //                 .find_map(|setup| get_opening_from_setup(setup.clone()).ok())
    //                 .unwrap_or_default();

    //             let p = progress.fetch_add(1, Ordering::Relaxed);
    //             if p.is_multiple_of(1000) || p == info.len() - 1 {
    //                 let _ = DatabaseProgress {
    //                     id: id.to_string(),
    //                     progress: (p as f64 / info.len() as f64) * 100_f64,
    //                 }
    //                 .emit(&app);
    //             }

    //             Some(SiteStatsData {
    //                 site: site.clone(),
    //                 player: player.clone().unwrap(),
    //                 data: vec![StatsData {
    //                     date: date.clone().unwrap(),
    //                     is_player_white: is_white,
    //                     player_elo: if is_white {
    //                         white_elo.unwrap()
    //                     } else {
    //                         black_elo.unwrap()
    //                     },
    //                     result: result.unwrap(),
    //                     time_control: time_control.clone().unwrap_or_default(),
    //                     opening,
    //                 }],
    //             })
    //         },
    //     )
    //     .fold(DashMap::new, |acc, data| {
    //         acc.entry((data.site.clone(), data.player.clone()))
    //             .or_insert_with(Vec::new)
    //             .extend(data.data);
    //         acc
    //     })
    //     .reduce(DashMap::new, |acc1, acc2| {
    //         for ((site, player), data) in acc2 {
    //             acc1.entry((site, player))
    //                 .or_insert_with(Vec::new)
    //                 .extend(data);
    //         }
    //         acc1
    //     })
    //     .into_iter()
    //     .map(|((site, player), data)| SiteStatsData { site, player, data })
    //     .collect();

    // println!("get_players_game_info {:?}: {:?}", file, timer.elapsed());

    // Ok(game_info)
    Ok(PlayerGameInfo::default())
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
    // let db = &mut get_db_or_create(&state, file.to_str().unwrap(), ConnectionOptions::default())?;

    // db.batch_execute(
    //     "
    //     DELETE FROM Games
    //     WHERE ID IN (
    //         SELECT ID
    //         FROM (
    //             SELECT ID,
    //                 ROW_NUMBER() OVER (PARTITION BY EventID, SiteID, Round, WhiteID, BlackID, Moves, Date, UTCTime ORDER BY ID) AS RowNum
    //             FROM Games
    //         ) AS Subquery
    //         WHERE RowNum > 1
    //     );
    //     ",
    // )?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_empty_games(
    file: PathBuf,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    // let db = &mut get_db_or_create(&state, file.to_str().unwrap(), ConnectionOptions::default())?;

    // diesel::delete(games::table.filter(games::ply_count.eq(0))).execute(db)?;

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
    load_aixchess_extension(&db)?;

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
            date,
            round,
            white,
            black,
            result,
            timecontrol,
            eco,
            whiteelo,
            blackelo,
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
                .get::<_, Option<i32>>("whiteelo")?
                .map(|v| v.to_string()),
            black_elo: row
                .get::<_, Option<i32>>("blackelo")?
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
    // let db = &mut get_db_or_create(&state, file.to_str().unwrap(), ConnectionOptions::default())?;

    // diesel::delete(games::table.filter(games::id.eq(game_id))).execute(db)?;

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
    // let db = &mut get_db_or_create(&state, file.to_str().unwrap(), ConnectionOptions::default())?;

    // let mut importer = Importer::new(None);
    // let mut parsed = BufferedReader::new(pgn.as_bytes())
    //     .into_iter(&mut importer)
    //     .flatten()
    //     .flatten();
    // let temp_game = parsed.next().ok_or(Error::NoMovesFound)?;

    // let white_id = if let Some(name) = temp_game.white_name.as_deref() {
    //     create_player(db, name)?.id
    // } else {
    //     0
    // };
    // let black_id = if let Some(name) = temp_game.black_name.as_deref() {
    //     create_player(db, name)?.id
    // } else {
    //     0
    // };
    // let event_id = if let Some(name) = temp_game.event_name.as_deref() {
    //     create_event(db, name)?.id
    // } else {
    //     0
    // };
    // let site_id = if let Some(name) = temp_game.site_name.as_deref() {
    //     create_site(db, name)?.id
    // } else {
    //     0
    // };

    // let final_material = get_material_count(temp_game.position.board());
    // let minimal_white_material = temp_game.material_count.white.min(final_material.white) as i32;
    // let minimal_black_material = temp_game.material_count.black.min(final_material.black) as i32;
    // let pawn_home = get_pawn_home(temp_game.position.board()) as i32;
    // let ply_count = iter_mainline_move_bytes(&temp_game.moves).count() as i32;

    // let updated_rows = diesel::update(games::table.filter(games::id.eq(game_id)))
    //     .set((
    //         games::event_id.eq(event_id),
    //         games::site_id.eq(site_id),
    //         games::date.eq(temp_game.date),
    //         games::time.eq(temp_game.time),
    //         games::round.eq(temp_game.round),
    //         games::white_id.eq(white_id),
    //         games::white_elo.eq(temp_game.white_elo),
    //         games::black_id.eq(black_id),
    //         games::black_elo.eq(temp_game.black_elo),
    //         games::white_material.eq(minimal_white_material),
    //         games::black_material.eq(minimal_black_material),
    //         games::result.eq(temp_game.result),
    //         games::time_control.eq(temp_game.time_control),
    //         games::eco.eq(temp_game.eco),
    //         games::ply_count.eq(ply_count),
    //         games::fen.eq(temp_game.fen),
    //         games::moves.eq(temp_game.moves),
    //         games::pawn_home.eq(pawn_home),
    //     ))
    //     .execute(db)?;

    // if updated_rows == 0 {
    //     return Err(Error::GameNotFound(game_id.to_string()));
    // }

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn merge_players(
    file: PathBuf,
    player1: i32,
    player2: i32,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    // let db = &mut get_db_or_create(&state, file.to_str().unwrap(), ConnectionOptions::default())?;

    // // Check if the players never played against each other
    // let count: i64 = games::table
    //     .filter(games::white_id.eq(player1).and(games::black_id.eq(player2)))
    //     .or_filter(games::white_id.eq(player2).and(games::black_id.eq(player1)))
    //     .limit(1)
    //     .count()
    //     .get_result(db)?;

    // if count > 0 {
    //     return Err(Error::NotDistinctPlayers);
    // }

    // diesel::update(games::table.filter(games::white_id.eq(player1)))
    //     .set(games::white_id.eq(player2))
    //     .execute(db)?;
    // diesel::update(games::table.filter(games::black_id.eq(player1)))
    //     .set(games::black_id.eq(player2))
    //     .execute(db)?;

    // diesel::delete(players::table.filter(players::id.eq(player1))).execute(db)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn home_row() {
        use shakmaty::Board;

        let pawn_home = get_pawn_home(&Board::default());
        assert_eq!(pawn_home, 0b1111111111111111);

        let pawn_home = get_pawn_home(
            &Board::from_ascii_board_fen(b"8/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/8").unwrap(),
        );
        assert_eq!(pawn_home, 0b1110111111101111);

        let pawn_home = get_pawn_home(&Board::from_ascii_board_fen(b"8/8/8/8/8/8/8/8").unwrap());
        assert_eq!(pawn_home, 0b0000000000000000);
    }
}
