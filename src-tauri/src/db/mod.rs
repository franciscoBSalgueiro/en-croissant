mod models;
mod ocgdb;
mod ops;
mod schema;
use crate::{
    db::{
        models::*,
        ocgdb::{decode_moves, position_search},
        ops::*,
        schema::*,
    },
    AppState,
};
use diesel::{
    connection::SimpleConnection,
    insert_into,
    prelude::*,
    r2d2::{ConnectionManager, Pool},
};
use pgn_reader::{BufferedReader, RawHeader, SanPlus, Skip, Visitor};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use shakmaty::{
    fen::Fen,
    zobrist::{Zobrist32, ZobristHash},
    Board, ByColor, Chess, EnPassantMode, Position,
};
use std::{
    ffi::OsStr,
    fs::{remove_file, File},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};
use tauri::State;
use tauri::{
    api::path::{resolve_path, BaseDirectory},
    Manager,
};

use self::ocgdb::encode_2byte_move;

fn get_material_count(board: &Board) -> ByColor<u8> {
    board.material().map(|material| {
        material.pawn
            + material.knight * 3
            + material.bishop * 3
            + material.rook * 5
            + material.queen * 9
    })
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
    pub opening: Vec<Zobrist32>,
    pub position: Chess,
    pub material_count: MaterialColor,
}

impl TempGame {
    pub fn insert_to_db(&self, db: &mut SqliteConnection) -> Result<(), String> {
        if let Some(result) = &self.result {
            if let Ok(outcome) = shakmaty::Outcome::from_ascii(result.as_bytes()) {
                for (i, hash) in self.opening.iter().enumerate() {
                    let m = &self.moves[(i * 2)..(i * 2) + 2];
                    add_opening(db, hash, m, outcome).map_err(|e| e.to_string())?;
                }
            }
        }

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

        let ply_count = (self.moves.len() / 2) as i32;
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
            time_control: self.time_control.as_deref(),
            site_id,
            event_id,
            fen: self.fen.as_deref(),
            result: self.result.as_deref(),
            moves2: self.moves.as_slice(),
        };

        create_game(db, new_game).map_err(|e| e.to_string())?;
        Ok(())
    }
}

struct Importer {
    game: TempGame,
    skip: bool,
}

impl Importer {
    fn new() -> Importer {
        Importer {
            game: TempGame::default(),
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
            if self.game.moves.len() < 80 {
                self.game
                    .opening
                    .push(self.game.position.zobrist_hash(EnPassantMode::Legal));
            }
            self.game.position.play_unchecked(&m);
            self.game
                .moves
                .extend_from_slice(&encode_2byte_move(&m).unwrap());
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

    db.batch_execute(
        "CREATE TABLE Info (Name TEXT UNIQUE NOT NULL, Value TEXT);
        CREATE TABLE Events (ID INTEGER PRIMARY KEY AUTOINCREMENT, Name TEXT UNIQUE);
        INSERT INTO Events (Name) VALUES (\"\");
        CREATE TABLE Sites (ID INTEGER PRIMARY KEY AUTOINCREMENT, Name TEXT UNIQUE);
        INSERT INTO Sites (Name) VALUES (\"\");
        CREATE TABLE Players (ID INTEGER PRIMARY KEY, Name TEXT UNIQUE, Elo INTEGER);
        CREATE TABLE Opening (
            ID INTEGER PRIMARY KEY AUTOINCREMENT,
            Hash BLOB,
            Move BLOB,
            White INTEGER,
            Draw INTEGER,
            Black INTEGER);
        CREATE INDEX OpeningHash ON Opening (Hash);
        CREATE TABLE Games (
            ID INTEGER PRIMARY KEY AUTOINCREMENT,
            EventID INTEGER,
            SiteID INTEGER,
            Date TEXT,
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
            Moves2 TEXT,
            FOREIGN KEY(EventID) REFERENCES Events,
            FOREIGN KEY(SiteID) REFERENCES Sites,
            FOREIGN KEY(WhiteID) REFERENCES Players,
            FOREIGN KEY(BlackID) REFERENCES Players);",
    )
    .or(Err("Failed to create tables"))?;

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

    let mut importer = Importer::new();
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
            game.insert_to_db(db).unwrap();
        }
        Ok(())
    })
    .unwrap();

    // Create all the necessary indexes
    db.batch_execute(
        "CREATE INDEX games_date_idx ON Games(Date);
        CREATE INDEX games_white_idx ON Games(WhiteID);
        CREATE INDEX games_black_idx ON Games(BlackID);
        CREATE INDEX games_result_idx ON Games(Result);
        CREATE INDEX games_white_elo_idx ON Games(WhiteElo);
        CREATE INDEX games_black_elo_idx ON Games(BlackElo);",
    )
    .expect("create indexes");

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

    insert_into(info::table)
        .values(vec![
            (
                info::name.eq("GameCount"),
                info::value.eq(game_count.to_string()),
            ),
            (
                info::name.eq("PlayerCount"),
                info::value.eq(player_count.to_string()),
            ),
            (
                info::name.eq("EventCount"),
                info::value.eq(event_count.to_string()),
            ),
            (
                info::name.eq("SiteCount"),
                info::value.eq(site_count.to_string()),
            ),
        ])
        .execute(db)
        .expect("insert game count");

    Ok(())
}

#[derive(Serialize)]
pub struct DatabaseInfo {
    title: String,
    description: String,
    player_count: usize,
    game_count: usize,
    storage_size: usize,
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
        &db_path,
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

    let title = "Untitled".to_string();

    let storage_size = path.metadata().expect("get metadata").len() as usize;
    let filename = path.file_name().expect("get filename").to_string_lossy();

    Ok(DatabaseInfo {
        title,
        description: filename.to_string(),
        player_count,
        game_count,
        storage_size,
    })
}

#[tauri::command]
pub async fn rename_db(
    file: PathBuf,
    title: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let pool = get_db_or_create(&state, file.to_str().unwrap(), ConnectionOptions::default())?;
    let db = &mut pool.get().unwrap();

    diesel::update(info::table)
        .filter(info::name.eq("Title"))
        .set(info::value.eq(title))
        .execute(db)
        .or(Err("update title"))?;

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

    dbg!(&query);

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

    sql_query = match query.options.sort {
        GameSort::Id => match query.options.direction {
            SortDirection::Asc => sql_query.order(games::id.asc()),
            SortDirection::Desc => sql_query.order(games::id.desc()),
        },
        GameSort::Date => match query.options.direction {
            SortDirection::Asc => sql_query.order(games::date.asc()),
            SortDirection::Desc => sql_query.order(games::date.desc()),
        },
        GameSort::WhiteElo => match query.options.direction {
            SortDirection::Asc => sql_query.order(games::white_elo.asc()),
            SortDirection::Desc => sql_query.order(games::white_elo.desc()),
        },
        GameSort::BlackElo => match query.options.direction {
            SortDirection::Asc => sql_query.order(games::black_elo.asc()),
            SortDirection::Desc => sql_query.order(games::black_elo.desc()),
        },
    };

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
            round: game.round,
            white,
            white_elo: game.white_elo,
            black,
            black_elo: game.black_elo,
            result: game.result,
            time_control: game.time_control,
            eco: game.eco,
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

    dbg!(&query);

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
        .group_by(games::result)
        .select((games::result, diesel::dsl::count(games::id)))
        .filter(games::white_id.eq(id).or(games::black_id.eq(id)));

    let info: Vec<(Option<String>, i64)> = sql_query.load(db).expect("load games");

    let mut game_info = PlayerGameInfo {
        won: 0,
        lost: 0,
        draw: 0,
    };

    for (outcome, count) in info {
        match outcome.unwrap_or_default().as_str() {
            "1-0" => game_info.won = count as usize,
            "0-1" => game_info.lost = count as usize,
            "1/2-1/2" => game_info.draw = count as usize,
            _ => (),
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
pub async fn search_position(
    file: PathBuf,
    fen: String,
    state: tauri::State<'_, AppState>,
) -> Result<(u64, u64, u64), String> {
    let pool = get_db_or_create(&state, file.to_str().unwrap(), ConnectionOptions::default())?;
    let db = &mut pool.get().unwrap();

    let processed_fen = Fen::from_ascii(fen.as_bytes()).or(Err("Invalid fen"))?;
    let processed_position: Chess = processed_fen
        .into_position(shakmaty::CastlingMode::Standard)
        .or(Err("Invalid fen"))?;

    let material = get_material_count(processed_position.board());

    // start counting the time
    let start = Instant::now();
    println!("start: {:?}", start.elapsed());

    let games = games::table
        .filter(games::white_material.le(material.white as i32))
        .filter(games::black_material.le(material.black as i32))
        .select(games::moves2)
        .load(db)
        .expect("load games");

    println!("got {} games: {:?}", games.len(), start.elapsed());
    let first_seconds: u64 = start.elapsed().as_millis().try_into().unwrap();

    let global_games = Arc::new(games);
    let counter = AtomicUsize::new(0);

    global_games.par_iter().for_each(|game| {
        if let Ok(true) = position_search(game, &processed_position, &material) {
            counter.fetch_add(1, Ordering::Relaxed);
        }
    });
    println!("done: {:?}", start.elapsed());
    let second_seconds: u64 = start.elapsed().as_millis().try_into().unwrap();

    Ok((
        first_seconds,
        second_seconds - first_seconds,
        counter.load(Ordering::Relaxed) as u64,
    ))
}

#[tauri::command]
pub async fn search_opening(
    file: PathBuf,
    fen: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<NormalizedOpening>, String> {
    let pool = get_db_or_create(&state, file.to_str().unwrap(), ConnectionOptions::default())?;
    let db = &mut pool.get().unwrap();

    let processed_fen = Fen::from_ascii(fen.as_bytes()).or(Err("Invalid fen"))?;
    let processed_position: Chess = processed_fen
        .into_position(shakmaty::CastlingMode::Standard)
        .or(Err("Invalid fen"))?;
    let hash: Zobrist32 = processed_position.zobrist_hash(EnPassantMode::Legal);

    let openings: Option<Vec<Opening>> = openings::table
        .filter(openings::hash.eq(hash.0 as i32))
        .get_results(db)
        .optional()
        .expect("load opening");

    dbg!(&openings);

    let normalized_openings = match openings {
        Some(openings) => openings.into_iter().map(NormalizedOpening::from).collect(),
        None => vec![],
    };

    Ok(normalized_openings)
}
