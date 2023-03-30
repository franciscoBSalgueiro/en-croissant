mod encoding;
mod models;
mod ops;
mod schema;
use crate::{
    db::{
        encoding::{decode_moves, position_search},
        models::*,
        ops::*,
        schema::*,
    },
    AppState,
};
use chrono::{NaiveDate, NaiveTime};
use dashmap::{mapref::entry::Entry, DashMap};
use diesel::{
    connection::SimpleConnection,
    insert_into,
    prelude::*,
    r2d2::{ConnectionManager, Pool},
};
use pgn_reader::{BufferedReader, RawHeader, SanPlus, Skip, Visitor};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use shakmaty::{fen::Fen, Board, ByColor, Chess, Piece, Position};

use std::{
    ffi::OsStr,
    fs::{remove_file, File},
    path::{Path, PathBuf},
    sync::atomic::Ordering,
    time::{Duration, Instant},
};
use tauri::State;
use tauri::{
    api::path::{resolve_path, BaseDirectory},
    Manager,
};

use self::encoding::encode_move;

pub use self::models::Puzzle;
pub use self::schema::puzzles;

fn get_material_count(board: &Board) -> ByColor<u8> {
    board.material().map(|material| {
        material.pawn
            + material.knight * 3
            + material.bishop * 3
            + material.rook * 5
            + material.queen * 9
    })
}

const WHITE_PAWN: Piece = Piece {
    color: shakmaty::Color::White,
    role: shakmaty::Role::Pawn,
};

const BLACK_PAWN: Piece = Piece {
    color: shakmaty::Color::Black,
    role: shakmaty::Role::Pawn,
};

fn get_pawn_home(board: &Board) -> u16 {
    let white_pawns = board.by_piece(WHITE_PAWN);
    let black_pawns = board.by_piece(BLACK_PAWN);
    let second_rank_pawns = (white_pawns.0 >> 8) as u8;
    let seventh_rank_pawns = (black_pawns.0 >> 48) as u8;
    (second_rank_pawns as u16) | ((seventh_rank_pawns as u16) << 8)
}

/// Returns true if the end pawn structure is reachable
fn is_end_reachable(end: u16, pos: u16) -> bool {
    end & !pos == 0
}

fn is_material_reachable(end: &ByColor<u8>, pos: &ByColor<u8>) -> bool {
    end.white <= pos.white && end.black <= pos.black
}

#[derive(Debug)]
pub enum JournalMode {
    Wal,
    Off,
}

#[derive(Debug)]
pub struct ConnectionOptions {
    pub journal_mode: JournalMode,
    pub enable_foreign_keys: bool,
    pub busy_timeout: Option<Duration>,
}

impl Default for ConnectionOptions {
    fn default() -> Self {
        Self {
            journal_mode: JournalMode::Wal,
            enable_foreign_keys: true,
            busy_timeout: Some(Duration::from_secs(30)),
        }
    }
}

impl diesel::r2d2::CustomizeConnection<SqliteConnection, diesel::r2d2::Error>
    for ConnectionOptions
{
    fn on_acquire(&self, conn: &mut SqliteConnection) -> Result<(), diesel::r2d2::Error> {
        (|| {
            match self.journal_mode {
                JournalMode::Wal => conn.batch_execute("PRAGMA journal_mode = WAL;")?,
                JournalMode::Off => conn.batch_execute("PRAGMA journal_mode = OFF;")?,
            }
            if self.enable_foreign_keys {
                conn.batch_execute("PRAGMA foreign_keys = ON;")?;
            }
            if let Some(d) = self.busy_timeout {
                conn.batch_execute(&format!("PRAGMA busy_timeout = {};", d.as_millis()))?;
            }
            Ok(())
        })()
        .map_err(diesel::r2d2::Error::QueryError)
    }
}

fn get_db_or_create(
    app_state: &State<AppState>,
    db_path: &str,
    options: ConnectionOptions,
) -> Result<diesel::r2d2::Pool<diesel::r2d2::ConnectionManager<diesel::SqliteConnection>>, String> {
    let mut state = app_state.0.lock().unwrap();
    if state.contains_key(db_path) {
        Ok(state.get(db_path).unwrap().clone())
    } else {
        let pool = Pool::builder()
            .max_size(16)
            .connection_customizer(Box::new(options))
            .build(ConnectionManager::<SqliteConnection>::new(db_path))
            .map_err(|err| err.to_string())?;
        state.insert(db_path.to_string(), pool.clone());
        Ok(pool)
    }
}

#[derive(Debug)]
pub struct MaterialColor {
    white: u8,
    black: u8,
}

impl Default for MaterialColor {
    fn default() -> Self {
        Self {
            white: 39,
            black: 39,
        }
    }
}

#[derive(Default, Debug, Serialize)]
pub struct TempPlayer {
    id: usize,
    name: Option<String>,
    rating: Option<i32>,
}

#[derive(Default, Debug)]
pub struct TempGame {
    pub event_name: Option<String>,
    pub site_name: Option<String>,
    pub date: Option<String>,
    pub time: Option<String>,
    pub round: Option<String>,
    pub white_name: Option<String>,
    pub white_elo: Option<i32>,
    pub black_name: Option<String>,
    pub black_elo: Option<i32>,
    pub result: Option<String>,
    pub time_control: Option<String>,
    pub eco: Option<String>,
    pub fen: Option<String>,
    pub moves: Vec<u8>,
    pub position: Chess,
    pub material_count: MaterialColor,
}

impl TempGame {
    pub fn insert_to_db(&self, db: &mut SqliteConnection) -> Result<(), String> {
        let pawn_home = get_pawn_home(self.position.board());

        let white;
        let black;
        let site_id;
        let event_id;

        if let Some(name) = &self.white_name {
            white = create_player(db, name).map_err(|e| e.to_string())?;
        } else {
            white = Player::default();
        }
        if let Some(name) = &self.black_name {
            black = create_player(db, name).map_err(|e| e.to_string())?;
        } else {
            black = Player::default();
        }

        if let Some(name) = &self.event_name {
            let event = create_event(db, name).map_err(|e| e.to_string())?;
            event_id = event.id;
        } else {
            event_id = 1;
        }

        if let Some(name) = &self.site_name {
            let site = create_site(db, name).map_err(|e| e.to_string())?;
            site_id = site.id;
        } else {
            site_id = 1;
        }

        let ply_count = (self.moves.len()) as i32;
        let final_material = get_material_count(self.position.board());
        let minimal_white_material = self.material_count.white.min(final_material.white) as i32;
        let minimal_black_material = self.material_count.black.min(final_material.black) as i32;

        let new_game = NewGame {
            white_id: Some(white.id),
            black_id: Some(black.id),
            ply_count,
            eco: self.eco.as_deref(),
            round: self.round.as_deref(),
            white_elo: self.white_elo,
            black_elo: self.black_elo,
            white_material: minimal_white_material,
            black_material: minimal_black_material,
            // max_rating: self.game.white.rating.max(self.game.black.rating),
            date: self.date.as_deref(),
            time: self.time.as_deref(),
            time_control: self.time_control.as_deref(),
            site_id,
            event_id,
            fen: self.fen.as_deref(),
            result: self.result.as_deref(),
            moves2: self.moves.as_slice(),
            pawn_home: pawn_home as i32,
        };

        create_game(db, new_game).map_err(|e| e.to_string())?;
        Ok(())
    }
}

struct Importer {
    game: TempGame,
    timestamp: Option<i64>,
    skip: bool,
}

impl Importer {
    fn new(timestamp: Option<usize>) -> Importer {
        Importer {
            game: TempGame::default(),
            timestamp: timestamp.map(|t| (t / 1000) as i64),
            skip: false,
        }
    }
}

impl Visitor for Importer {
    type Result = TempGame;

    fn begin_game(&mut self) {
        self.skip = false;
    }

    fn header(&mut self, key: &[u8], value: RawHeader<'_>) {
        if key == b"White" {
            self.game.white_name = Some(value.decode_utf8_lossy().into_owned());
        } else if key == b"Black" {
            self.game.black_name = Some(value.decode_utf8_lossy().into_owned());
        } else if key == b"WhiteElo" {
            if value.as_bytes() != b"?" {
                self.game.white_elo = Some(btoi::btoi(value.as_bytes()).expect("WhiteElo"));
            }
        } else if key == b"BlackElo" {
            if value.as_bytes() != b"?" {
                self.game.black_elo = Some(btoi::btoi(value.as_bytes()).expect("BlackElo"));
            }
        } else if key == b"TimeControl" {
            self.game.time_control = Some(value.decode_utf8_lossy().into_owned());
        } else if key == b"ECO" {
            self.game.eco = Some(value.decode_utf8_lossy().into_owned());
        } else if key == b"Round" {
            self.game.round = Some(value.decode_utf8_lossy().into_owned());
        } else if key == b"Date" || key == b"UTCDate" {
            self.game.date = Some(String::from_utf8_lossy(value.as_bytes()).to_string());
        } else if key == b"UTCTime" {
            self.game.time = Some(String::from_utf8_lossy(value.as_bytes()).to_string());
        } else if key == b"WhiteTitle" || key == b"BlackTitle" {
            if value.as_bytes() == b"BOT" {
                self.skip = true;
            }
        } else if key == b"Site" {
            self.game.site_name = Some(String::from_utf8_lossy(value.as_bytes()).to_string());
        } else if key == b"Event" {
            self.game.event_name = Some(String::from_utf8_lossy(value.as_bytes()).to_string());
        } else if key == b"Result" {
            self.game.result = Some(String::from_utf8_lossy(value.as_bytes()).to_string());
        } else if key == b"FEN" {
            if value.as_bytes() == b"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" {
                self.game.fen = None;
            } else {
                // Don't process games that don't start in standard position
                self.skip = true;
                // self.current.fen = Some(value.decode_utf8_lossy().into_owned());
            }
        }
    }

    fn end_headers(&mut self) -> Skip {
        // Skip games with timestamp before
        let cur_timestamp = self.game.date.as_ref().and_then(|date| {
            let date = NaiveDate::parse_from_str(date, "%Y.%m.%d").ok()?;
            let time = self
                .game
                .time
                .as_ref()
                .and_then(|time| NaiveTime::parse_from_str(time, "%H:%M:%S").ok())?;
            Some(date.and_time(time).timestamp())
        });

        if let (Some(cur_timestamp), Some(timestamp)) = (cur_timestamp, self.timestamp) {
            if cur_timestamp <= timestamp {
                self.skip = true;
            }
        }

        // Skip games without ELO
        // self.skip |= self.current.white_elo.is_none() || self.current.black_elo.is_none();
        Skip(self.skip)
    }

    fn san(&mut self, san: SanPlus) {
        let m = san.san.to_move(&self.game.position).ok();
        if let Some(m) = m {
            if m.is_promotion() {
                let cur_material = get_material_count(self.game.position.board());
                if cur_material.white < self.game.material_count.white {
                    self.game.material_count.white = cur_material.white;
                }
                if cur_material.black < self.game.material_count.black {
                    self.game.material_count.black = cur_material.black;
                }
            }
            self.game
                .moves
                .push(encode_move(&m, &self.game.position).unwrap());
            self.game.position.play_unchecked(&m);
        } else {
            self.skip = true;
        }
    }

    fn begin_variation(&mut self) -> Skip {
        Skip(true) // stay in the mainline
    }

    fn end_game(&mut self) -> Self::Result {
        std::mem::take(&mut self.game)
    }
}

#[tauri::command]
pub async fn convert_pgn(
    file: PathBuf,
    timestamp: Option<usize>,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    // get the name of the file without the extension
    let filename = file.file_stem().expect("file name");
    let extension = file.extension().expect("file extension");
    let db_filename = Path::new("db").join(filename).with_extension("db3");

    // export the database to the AppData folder
    let destination = resolve_path(
        &app.config(),
        app.package_info(),
        &app.env(),
        &db_filename,
        Some(BaseDirectory::AppData),
    )
    .expect("resolve path");

    let db_exists = destination.exists();

    // create the database file
    let pool = get_db_or_create(
        &state,
        destination.to_str().unwrap(),
        ConnectionOptions {
            enable_foreign_keys: false,
            busy_timeout: None,
            journal_mode: JournalMode::Off,
        },
    )?;
    let db = &mut pool.get().unwrap();

    if !db_exists {
        db.batch_execute(
            "CREATE TABLE Info (Name TEXT UNIQUE NOT NULL, Value TEXT);
        CREATE TABLE Events (ID INTEGER PRIMARY KEY AUTOINCREMENT, Name TEXT UNIQUE);
        INSERT INTO Events (Name) VALUES (\"\");
        CREATE TABLE Sites (ID INTEGER PRIMARY KEY AUTOINCREMENT, Name TEXT UNIQUE);
        INSERT INTO Sites (Name) VALUES (\"\");
        CREATE TABLE Players (ID INTEGER PRIMARY KEY, Name TEXT UNIQUE, Elo INTEGER);
        CREATE TABLE Games (
            ID INTEGER PRIMARY KEY AUTOINCREMENT,
            EventID INTEGER,
            SiteID INTEGER,
            Date TEXT,
            UTCTime TEXT,
            Round INTEGER,
            WhiteID INTEGER,
            WhiteElo INTEGER,
            BlackID INTEGER,
            BlackElo INTEGER,
            WhiteMaterial INTEGER,
            BlackMaterial INTEGER,
            Result INTEGER,
            TimeControl TEXT,
            ECO TEXT,
            PlyCount INTEGER,
            FEN TEXT,
            Moves2 BLOB,
            PawnHome BLOB,
            FOREIGN KEY(EventID) REFERENCES Events,
            FOREIGN KEY(SiteID) REFERENCES Sites,
            FOREIGN KEY(WhiteID) REFERENCES Players,
            FOREIGN KEY(BlackID) REFERENCES Players);",
        )
        .or(Err("Failed to create tables"))?;
    }

    let file =
        File::open(&file).unwrap_or_else(|_| panic!("open pgn file: {}", file.to_str().unwrap()));

    let uncompressed: Box<dyn std::io::Read + Send> = if extension == OsStr::new("bz2") {
        Box::new(bzip2::read::MultiBzDecoder::new(file))
    } else if extension == OsStr::new("zst") {
        Box::new(zstd::Decoder::new(file).expect("zstd decoder"))
    } else {
        Box::new(file)
    };

    // start counting time
    let start = Instant::now();

    let mut importer = Importer::new(timestamp);
    db.transaction::<_, diesel::result::Error, _>(|db| {
        for (i, game) in BufferedReader::new(uncompressed)
            .into_iter(&mut importer)
            .flatten()
            .enumerate()
        {
            if i % 1000 == 0 {
                let elapsed = start.elapsed().as_millis() as u32;
                app.emit_all("convert_progress", (i, elapsed)).unwrap();
            }
            if !game.moves.is_empty() {
                game.insert_to_db(db).unwrap();
            }
        }
        Ok(())
    })
    .unwrap();

    if !db_exists {
        // Create all the necessary indexes
        db.batch_execute(
            "CREATE INDEX games_date_idx ON Games(Date);
            CREATE INDEX games_white_idx ON Games(WhiteID);
            CREATE INDEX games_black_idx ON Games(BlackID);
            CREATE INDEX games_result_idx ON Games(Result);
            CREATE INDEX games_white_elo_idx ON Games(WhiteElo);
            CREATE INDEX games_black_elo_idx ON Games(BlackElo);
        ",
        )
        .expect("create indexes");
    }

    // get game, player, event and site counts and to the info table
    let game_count: i64 = games::table.count().get_result(db).expect("get game count");
    let player_count: i64 = players::table
        .count()
        .get_result(db)
        .expect("get player count");
    let event_count: i64 = events::table
        .count()
        .get_result(db)
        .expect("get event count");
    let site_count: i64 = sites::table.count().get_result(db).expect("get site count");

    let counts = vec![
        ("GameCount", game_count),
        ("PlayerCount", player_count),
        ("EventCount", event_count),
        ("SiteCount", site_count),
    ];

    for c in counts.iter() {
        insert_into(info::table)
            .values((info::name.eq(c.0), info::value.eq(c.1.to_string())))
            .on_conflict(info::name)
            .do_update()
            .set(info::value.eq(c.1.to_string()))
            .execute(db)
            .expect("insert game count");
    }

    Ok(())
}

#[derive(Serialize)]
pub struct DatabaseInfo {
    title: String,
    description: String,
    player_count: usize,
    game_count: usize,
    storage_size: usize,
    filename: String,
}

#[tauri::command]
pub async fn get_db_info(
    file: PathBuf,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<DatabaseInfo, String> {
    let db_path = PathBuf::from("db").join(file);

    let path = resolve_path(
        &app.config(),
        app.package_info(),
        &app.env(),
        db_path,
        Some(BaseDirectory::AppData),
    )
    .or(Err("resolve path"))?;

    let pool = get_db_or_create(&state, path.to_str().unwrap(), ConnectionOptions::default())?;
    let db = &mut pool.get().unwrap();

    let player_count_info: Info = info::table
        .filter(info::name.eq("PlayerCount"))
        .first(db)
        .or(Err("get player count"))?;
    let player_count = player_count_info
        .value
        .unwrap()
        .parse::<usize>()
        .or(Err("parse player count"))?;

    let game_count_info: Info = info::table
        .filter(info::name.eq("GameCount"))
        .first(db)
        .or(Err("get game count"))?;
    let game_count = game_count_info
        .value
        .unwrap()
        .parse::<usize>()
        .or(Err("parse game count"))?;

    let title = match info::table
        .filter(info::name.eq("Title"))
        .first(db)
        .map(|title_info: Info| title_info.value)
    {
        Ok(Some(title)) => title,
        _ => "Untitled".to_string(),
    };

    let description = match info::table
        .filter(info::name.eq("Description"))
        .first(db)
        .map(|description_info: Info| description_info.value)
    {
        Ok(Some(description)) => description,
        _ => "".to_string(),
    };

    let storage_size = path.metadata().expect("get metadata").len() as usize;
    let filename = path.file_name().expect("get filename").to_string_lossy();

    Ok(DatabaseInfo {
        title,
        description,
        player_count,
        game_count,
        storage_size,
        filename: filename.to_string(),
    })
}

#[tauri::command]
pub async fn edit_db_info(
    file: PathBuf,
    title: Option<String>,
    description: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let pool = get_db_or_create(&state, file.to_str().unwrap(), ConnectionOptions::default())?;
    let db = &mut pool.get().unwrap();

    if let Some(title) = title {
        diesel::insert_into(info::table)
            .values((info::name.eq("Title"), info::value.eq(title.clone())))
            .on_conflict(info::name)
            .do_update()
            .set(info::value.eq(title))
            .execute(db)
            .or(Err("upsert title"))?;
    }

    if let Some(description) = description {
        diesel::insert_into(info::table)
            .values((
                info::name.eq("Description"),
                info::value.eq(description.clone()),
            ))
            .on_conflict(info::name)
            .do_update()
            .set(info::value.eq(description))
            .execute(db)
            .or(Err("upsert description"))?;
    }

    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum Sides {
    BlackWhite,
    WhiteBlack,
    Any,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GameSort {
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SortDirection {
    #[serde(rename = "asc")]
    Asc,
    #[serde(rename = "desc")]
    Desc,
}

#[derive(Debug, Clone, Deserialize)]
pub struct QueryOptions<SortT> {
    pub skip_count: bool,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub sort: SortT,
    pub direction: SortDirection,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GameQuery {
    pub options: QueryOptions<GameSort>,
    pub player1: Option<String>,
    pub player2: Option<String>,
    pub range1: Option<(i32, i32)>,
    pub range2: Option<(i32, i32)>,
    pub sides: Option<Sides>,
    pub outcome: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct QueryResponse<T> {
    pub data: T,
    pub count: Option<i64>,
}

#[tauri::command]
pub async fn get_games(
    file: PathBuf,
    query: GameQuery,
    state: tauri::State<'_, AppState>,
) -> Result<QueryResponse<Vec<NormalizedGame>>, String> {
    let pool = get_db_or_create(&state, file.to_str().unwrap(), ConnectionOptions::default())?;
    let db = &mut pool.get().unwrap();

    let mut count: Option<i64> = None;

    let (white_players, black_players) = diesel::alias!(players as white, players as black);
    let mut sql_query = games::table
        .inner_join(white_players.on(games::white_id.eq(white_players.field(players::id))))
        .inner_join(black_players.on(games::black_id.eq(black_players.field(players::id))))
        .inner_join(events::table.on(games::event_id.eq(events::id)))
        .inner_join(sites::table.on(games::site_id.eq(sites::id)))
        .into_boxed();
    let mut count_query = games::table
        .inner_join(white_players.on(games::white_id.eq(white_players.field(players::id))))
        .inner_join(black_players.on(games::black_id.eq(black_players.field(players::id))))
        .into_boxed();

    // if let Some(speed) = query.speed {
    //     sql_query = sql_query.filter(games::speed.eq(speed as i32));
    //     count_query = count_query.filter(games::speed.eq(speed as i32));
    // }

    if let Some(outcome) = query.outcome {
        sql_query = sql_query.filter(games::result.eq(outcome.clone()));
        count_query = count_query.filter(games::result.eq(outcome));
    }

    if let Some(limit) = query.options.page_size {
        sql_query = sql_query.limit(limit);
    }

    if let Some(page) = query.options.page {
        sql_query = sql_query.offset((page - 1) * query.options.page_size.unwrap_or(10));
    }

    match query.sides {
        Some(Sides::BlackWhite) => {
            if let Some(player1) = query.player1 {
                sql_query =
                    sql_query.filter(black_players.field(players::name).eq(player1.clone()));
                count_query = count_query.filter(black_players.field(players::name).eq(player1));
            }
            if let Some(player2) = query.player2 {
                sql_query =
                    sql_query.filter(white_players.field(players::name).eq(player2.clone()));
                count_query = count_query.filter(white_players.field(players::name).eq(player2));
            }

            if let Some(range1) = query.range1 {
                sql_query = sql_query.filter(games::black_elo.between(range1.0, range1.1));
                count_query = count_query.filter(games::black_elo.between(range1.0, range1.1));
            }

            if let Some(range2) = query.range2 {
                sql_query = sql_query.filter(games::white_elo.between(range2.0, range2.1));
                count_query = count_query.filter(games::white_elo.between(range2.0, range2.1));
            }
        }
        Some(Sides::WhiteBlack) => {
            if let Some(player1) = query.player1 {
                sql_query =
                    sql_query.filter(white_players.field(players::name).eq(player1.clone()));
                count_query = count_query.filter(white_players.field(players::name).eq(player1));
            }
            if let Some(player2) = query.player2 {
                sql_query =
                    sql_query.filter(black_players.field(players::name).eq(player2.clone()));
                count_query = count_query.filter(black_players.field(players::name).eq(player2));
            }

            if let Some(range1) = query.range1 {
                sql_query = sql_query.filter(games::white_elo.between(range1.0, range1.1));
                count_query = count_query.filter(games::white_elo.between(range1.0, range1.1));
            }

            if let Some(range2) = query.range2 {
                sql_query = sql_query.filter(games::black_elo.between(range2.0, range2.1));
                count_query = count_query.filter(games::black_elo.between(range2.0, range2.1));
            }
        }
        Some(Sides::Any) => {
            if let Some(player1) = query.player1 {
                sql_query = sql_query.filter(
                    white_players
                        .field(players::name)
                        .eq(player1.clone())
                        .or(black_players.field(players::name).eq(player1.clone())),
                );
                count_query = count_query.filter(
                    white_players
                        .field(players::name)
                        .eq(player1.clone())
                        .or(black_players.field(players::name).eq(player1)),
                );
            }
            if let Some(player2) = query.player2 {
                sql_query = sql_query.filter(
                    white_players
                        .field(players::name)
                        .eq(player2.clone())
                        .or(black_players.field(players::name).eq(player2.clone())),
                );
                count_query = count_query.filter(
                    white_players
                        .field(players::name)
                        .eq(player2.clone())
                        .or(black_players.field(players::name).eq(player2)),
                );
            }

            if query.range1.is_some() && query.range2.is_some() {
                let range1 = query.range1.unwrap();
                let range2 = query.range2.unwrap();
                sql_query = sql_query.filter(
                    games::white_elo
                        .between(range1.0, range1.1)
                        .or(games::black_elo.between(range1.0, range1.1))
                        .or(games::white_elo
                            .between(range2.0, range2.1)
                            .or(games::black_elo.between(range2.0, range2.1))),
                );
                count_query = count_query.filter(
                    games::white_elo
                        .between(range1.0, range1.1)
                        .or(games::black_elo.between(range1.0, range1.1))
                        .or(games::white_elo
                            .between(range2.0, range2.1)
                            .or(games::black_elo.between(range2.0, range2.1))),
                );
            } else {
                if let Some(range1) = query.range1 {
                    sql_query = sql_query.filter(
                        games::white_elo
                            .between(range1.0, range1.1)
                            .or(games::black_elo.between(range1.0, range1.1)),
                    );
                    count_query = count_query.filter(
                        games::white_elo
                            .between(range1.0, range1.1)
                            .or(games::black_elo.between(range1.0, range1.1)),
                    );
                }

                if let Some(range2) = query.range2 {
                    sql_query = sql_query.filter(
                        games::white_elo
                            .between(range2.0, range2.1)
                            .or(games::black_elo.between(range2.0, range2.1)),
                    );
                    count_query = count_query.filter(
                        games::white_elo
                            .between(range2.0, range2.1)
                            .or(games::black_elo.between(range2.0, range2.1)),
                    );
                }
            }
        }
        None => {}
    }

    sql_query = match query.options.sort {
        GameSort::Id => match query.options.direction {
            SortDirection::Asc => sql_query.order(games::id.asc()),
            SortDirection::Desc => sql_query.order(games::id.desc()),
        },
        GameSort::Date => match query.options.direction {
            SortDirection::Asc => sql_query.order((games::date.asc(), games::time.asc())),
            SortDirection::Desc => sql_query.order((games::date.desc(), games::time.desc())),
        },
        GameSort::WhiteElo => match query.options.direction {
            SortDirection::Asc => sql_query.order(games::white_elo.asc()),
            SortDirection::Desc => sql_query.order(games::white_elo.desc()),
        },
        GameSort::BlackElo => match query.options.direction {
            SortDirection::Asc => sql_query.order(games::black_elo.asc()),
            SortDirection::Desc => sql_query.order(games::black_elo.desc()),
        },
        GameSort::PlyCount => match query.options.direction {
            SortDirection::Asc => sql_query.order(games::ply_count.asc()),
            SortDirection::Desc => sql_query.order(games::ply_count.desc()),
        },
    };

    if !query.options.skip_count {
        count = Some(
            count_query
                .select(diesel::dsl::count(games::id))
                .first(db)
                .expect("count games"),
        );
    }

    let games: Vec<(Game, Player, Player, Event, Site)> = sql_query.load(db).expect("load games");
    let normalized_games = normalize_games(games);

    Ok(QueryResponse {
        data: normalized_games,
        count,
    })
}

fn normalize_games(games: Vec<(Game, Player, Player, Event, Site)>) -> Vec<NormalizedGame> {
    games
        .into_iter()
        .map(|(game, white, black, event, site)| NormalizedGame {
            id: game.id,
            event,
            site,
            date: game.date,
            time: game.time,
            round: game.round,
            white,
            white_elo: game.white_elo,
            black,
            black_elo: game.black_elo,
            result: game.result,
            time_control: game.time_control,
            eco: game.eco,
            white_material: game.white_material,
            black_material: game.black_material,
            ply_count: game.ply_count,
            fen: game.fen,
            moves: decode_moves(game.moves2).unwrap_or_default(),
        })
        .collect()
}

#[derive(Debug, Clone, Deserialize)]
pub struct PlayerQuery {
    pub options: QueryOptions<PlayerSort>,
    pub name: Option<String>,
    pub range: Option<(i32, i32)>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PlayerSort {
    #[serde(rename = "id")]
    Id,
    #[serde(rename = "name")]
    Name,
    #[serde(rename = "elo")]
    Elo,
}

#[tauri::command]
pub async fn get_players(
    file: PathBuf,
    query: PlayerQuery,
    state: tauri::State<'_, AppState>,
) -> Result<QueryResponse<Vec<Player>>, String> {
    let pool = get_db_or_create(&state, file.to_str().unwrap(), ConnectionOptions::default())?;
    let db = &mut pool.get().unwrap();
    let mut count = None;

    let mut sql_query = players::table.into_boxed();
    let mut count_query = players::table.into_boxed();

    if let Some(name) = query.name {
        sql_query = sql_query.filter(players::name.like(format!("%{}%", name)));
        count_query = count_query.filter(players::name.like(format!("%{}%", name)));
    }

    if let Some(range) = query.range {
        sql_query = sql_query.filter(players::elo.between(range.0, range.1));
        count_query = count_query.filter(players::elo.between(range.0, range.1));
    }

    if !query.options.skip_count {
        count = Some(count_query.count().get_result(db).expect("count players"));
    }

    if let Some(limit) = query.options.page_size {
        sql_query = sql_query.limit(limit);
    }

    if let Some(page) = query.options.page {
        sql_query = sql_query.offset((page - 1) * query.options.page_size.unwrap_or(10));
    }

    sql_query = match query.options.sort {
        PlayerSort::Id => match query.options.direction {
            SortDirection::Asc => sql_query.order(players::id.asc()),
            SortDirection::Desc => sql_query.order(players::id.desc()),
        },
        PlayerSort::Name => match query.options.direction {
            SortDirection::Asc => sql_query.order(players::name.asc()),
            SortDirection::Desc => sql_query.order(players::name.desc()),
        },
        PlayerSort::Elo => match query.options.direction {
            SortDirection::Asc => sql_query.order(players::elo.asc()),
            SortDirection::Desc => sql_query.order(players::elo.desc()),
        },
    };

    let players = sql_query.load::<Player>(db).expect("load players");

    Ok(QueryResponse {
        data: players,
        count,
    })
}

#[derive(Debug, Clone, Serialize)]
pub struct PlayerGameInfo {
    pub won: usize,
    pub lost: usize,
    pub draw: usize,
    pub games_per_month: Vec<(String, usize)>,
}

#[tauri::command]
pub async fn get_players_game_info(
    file: PathBuf,
    id: i32,
    state: tauri::State<'_, AppState>,
) -> Result<PlayerGameInfo, String> {
    let pool = get_db_or_create(&state, file.to_str().unwrap(), ConnectionOptions::default())?;
    let db = &mut pool.get().unwrap();

    let sql_query = games::table
        .select((games::result, games::date))
        .filter(games::white_id.eq(id).or(games::black_id.eq(id)));

    let info: Vec<(Option<String>, Option<String>)> = sql_query.load(db).expect("load games");

    let mut game_info = PlayerGameInfo {
        won: 0,
        lost: 0,
        draw: 0,
        games_per_month: vec![],
    };

    for (outcome, date) in info {
        match outcome.unwrap_or_default().as_str() {
            "1-0" => game_info.won += 1,
            "0-1" => game_info.lost += 1,
            "1/2-1/2" => game_info.draw += 1,
            _ => (),
        }

        if let Some(date) = date {
            let date = NaiveDate::parse_from_str(&date, "%Y.%m.%d").unwrap();
            let month = date.format("%Y-%m").to_string();

            // increment month count or add new month
            if let Some((_, count)) = game_info
                .games_per_month
                .iter_mut()
                .find(|(m, _)| m == &month)
            {
                *count += 1;
            } else {
                game_info.games_per_month.push((month, 1));
            }
        }
    }

    Ok(game_info)
}

#[tauri::command]
pub async fn delete_database(
    file: PathBuf,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mut state = state.0.lock().unwrap();
    let path_str = file.to_str().unwrap();
    if state.contains_key(path_str) {
        state.remove(path_str);
    }

    // delete file
    remove_file(path_str).map_err(|_| format!("Could not delete file {}", path_str))?;
    Ok(())
}

#[tauri::command]
pub fn clear_games(state: tauri::State<'_, AppState>) {
    let mut state = state.2.lock().unwrap();
    state.clear();
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PositionStats {
    #[serde(rename = "move")]
    pub move_: String,
    pub white: i32,
    pub draw: i32,
    pub black: i32,
}

#[tauri::command]
pub async fn search_position(
    file: PathBuf,
    fen: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<PositionStats>, String> {
    let pool = get_db_or_create(&state, file.to_str().unwrap(), ConnectionOptions::default())?;
    let db = &mut pool.get().unwrap();

    {
        let pos_cache = state.1.lock().unwrap();

        if let Some(pos) = pos_cache.get(&(fen.clone(), file.clone())) {
            return Ok(pos.clone());
        }
    }

    let processed_fen = Fen::from_ascii(fen.as_bytes()).or(Err("Invalid fen"))?;
    let processed_position: Chess = processed_fen
        .into_position(shakmaty::CastlingMode::Standard)
        .or(Err("Invalid fen"))?;

    let material = get_material_count(processed_position.board());
    let pawn_home = get_pawn_home(processed_position.board());

    // start counting the time
    let start = Instant::now();
    println!("start: {:?}", start.elapsed());

    state.3.store(true, Ordering::Relaxed);
    let mut games = state.2.lock().unwrap();
    state.3.store(false, Ordering::Relaxed);

    if games.is_empty() {
        *games = games::table
            .select((
                games::result,
                games::moves2,
                games::pawn_home,
                games::white_material,
                games::black_material,
            ))
            .load(db)
            .expect("load games");

        println!("got {} games: {:?}", games.len(), start.elapsed());
    }

    let openings: DashMap<String, PositionStats> = DashMap::new();

    games.par_iter().for_each(
        |(result, game, end_pawn_home, white_material, black_material)| {
            if state.3.load(Ordering::Relaxed) {
                return;
            }
            let end_material: ByColor<u8> = ByColor {
                white: *white_material as u8,
                black: *black_material as u8,
            };
            if is_end_reachable(*end_pawn_home as u16, pawn_home)
                && is_material_reachable(&end_material, &material)
            {
                if let Ok(Some(m)) =
                    position_search(game, &processed_position, &end_material, pawn_home)
                {
                    let entry = openings.entry(m);
                    match entry {
                        Entry::Occupied(mut e) => {
                            let opening = e.get_mut();
                            match result.as_deref() {
                                Some("1-0") => opening.white += 1,
                                Some("0-1") => opening.black += 1,
                                Some("1/2-1/2") => opening.draw += 1,
                                _ => (),
                            }
                        }
                        Entry::Vacant(e) => {
                            let mut opening = PositionStats {
                                black: 0,
                                white: 0,
                                draw: 0,
                                move_: e.key().to_string(),
                            };
                            match result.as_deref() {
                                Some("1-0") => opening.white = 1,
                                Some("0-1") => opening.black = 1,
                                Some("1/2-1/2") => opening.draw = 1,
                                _ => (),
                            }
                            e.insert(opening);
                        }
                    }
                }
            }
        },
    );
    println!("done: {:?}", start.elapsed());
    if state.3.load(Ordering::Relaxed) {
        return Err("Search stopped".to_string());
    }

    let openings: Vec<PositionStats> = openings.into_iter().map(|(_, v)| v).collect();

    let mut pos_cache = state.1.lock().unwrap();
    pos_cache.insert((fen, file), openings.clone());

    Ok(openings)
}
