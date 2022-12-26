use serde_with::{formats::SpaceSeparator, serde_as, DisplayFromStr, StringWithSeparator};
use std::{
    ffi::OsStr,
    fs::File,
    io, mem,
    path::{Path, PathBuf},
};

use pgn_reader::{BufferedReader, Color, Outcome, RawHeader, SanPlus, Skip, Visitor};
use rusqlite::named_params;
use serde::{Deserialize, Serialize};
use tauri::{
    api::path::{resolve_path, BaseDirectory},
    Manager,
};

#[derive(Debug, Copy, Clone, Serialize, Deserialize)]
pub enum Speed {
    UltraBullet,
    Bullet,
    Blitz,
    Rapid,
    Classical,
    Correspondence,
}

impl Speed {
    fn from_seconds_and_increment(seconds: u64, increment: u64) -> Speed {
        let total = seconds + 40 * increment;

        if total < 30 {
            Speed::UltraBullet
        } else if total < 180 {
            Speed::Bullet
        } else if total < 480 {
            Speed::Blitz
        } else if total < 1500 {
            Speed::Rapid
        } else if total < 21_600 {
            Speed::Classical
        } else {
            Speed::Correspondence
        }
    }

    fn from_bytes(bytes: &[u8]) -> Result<Speed, ()> {
        if bytes == b"-" {
            return Ok(Speed::Correspondence);
        }

        let mut parts = bytes.splitn(2, |ch| *ch == b'+');
        let seconds = btoi::btou(parts.next().ok_or(())?).map_err(|_| ())?;
        let increment = btoi::btou(parts.next().ok_or(())?).map_err(|_| ())?;
        Ok(Speed::from_seconds_and_increment(seconds, increment))
    }

    fn from(u: u8) -> Speed {
        match u {
            0 => Speed::UltraBullet,
            1 => Speed::Bullet,
            2 => Speed::Blitz,
            3 => Speed::Rapid,
            4 => Speed::Classical,
            5 => Speed::Correspondence,
            _ => unreachable!(),
        }
    }
}

struct Batch {
    games: Vec<Game>,
}

struct Importer {
    db: rusqlite::Connection,
    batch_size: usize,
    current: Game,
    skip: bool,
    batch: Vec<Game>,
}

#[serde_as]
#[derive(Default, Debug, Serialize)]
pub struct Game {
    speed: Option<Speed>,
    fen: Option<String>,
    id: Option<String>,
    date: Option<String>,
    white: Player,
    black: Player,
    #[serde_as(as = "Option<DisplayFromStr>")]
    outcome: Option<Outcome>,
    #[serde_as(as = "StringWithSeparator<SpaceSeparator, SanPlus>")]
    moves: Vec<SanPlus>,
}

#[derive(Default, Debug, Serialize)]
pub struct Player {
    name: Option<String>,
    rating: Option<u16>,
}

impl Importer {
    fn new(batch_size: usize, db: rusqlite::Connection) -> Importer {
        Importer {
            db,
            batch_size,
            current: Game::default(),
            skip: false,
            batch: Vec::with_capacity(batch_size),
        }
    }

    pub fn send(&mut self) {
        let batch = Batch {
            games: mem::replace(&mut self.batch, Vec::with_capacity(self.batch_size)),
        };

        let tx = self.db.transaction().expect("Failed to start transaction");

        for game in batch.games {
            fn insert_player(tx: &rusqlite::Transaction, name: &str) {
                tx.execute(
                    "INSERT OR IGNORE INTO player (name) VALUES (?)",
                    rusqlite::params![name],
                )
                .expect("Failed to insert player");
            }

            if let Some(name) = &game.white.name {
                insert_player(&tx, name);
            }

            if let Some(name) = &game.black.name {
                insert_player(&tx, name);
            }

            tx.execute(
                "INSERT INTO game (
                    id,
                    white,
                    black,
                    white_rating,
                    black_rating,
                    date,
                    speed,
                    fen,
                    outcome,
                    moves
                ) VALUES (?1,
                    (SELECT id FROM player WHERE name = ?2),
                    (SELECT id FROM player WHERE name = ?3),
                    ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                rusqlite::params![
                    game.id,
                    game.white.name,
                    game.black.name,
                    game.white.rating,
                    game.black.rating,
                    game.date,
                    game.speed.map(|s| s as u8),
                    game.fen,
                    game.outcome.map(|r| match r {
                        Outcome::Decisive { winner } => match winner {
                            Color::White => 1,
                            Color::Black => 2,
                        },
                        Outcome::Draw => 3,
                    }),
                    game.moves
                        .iter()
                        .map(|m| m.san.to_string())
                        .collect::<Vec<_>>()
                        .join(" ")
                ],
            )
            .expect("Failed to insert game");
        }

        tx.commit().expect("Failed to commit transaction");
    }
}

impl Visitor for Importer {
    type Result = ();

    fn begin_game(&mut self) {
        self.skip = false;
        self.current = Game::default();
    }

    fn header(&mut self, key: &[u8], value: RawHeader<'_>) {
        if key == b"White" {
            self.current.white.name = Some(value.decode_utf8().expect("White").into_owned());
        } else if key == b"Black" {
            self.current.black.name = Some(value.decode_utf8().expect("Black").into_owned());
        } else if key == b"WhiteElo" {
            if value.as_bytes() != b"?" {
                self.current.white.rating = Some(btoi::btoi(value.as_bytes()).expect("WhiteElo"));
            }
        } else if key == b"BlackElo" {
            if value.as_bytes() != b"?" {
                self.current.black.rating = Some(btoi::btoi(value.as_bytes()).expect("BlackElo"));
            }
        } else if key == b"TimeControl" {
            self.current.speed = Some(Speed::from_bytes(value.as_bytes()).expect("TimeControl"));
        } else if key == b"Date" || key == b"UTCDate" {
            self.current.date = Some(String::from_utf8(value.as_bytes().to_owned()).expect("Date"));
        } else if key == b"WhiteTitle" || key == b"BlackTitle" {
            if value.as_bytes() == b"BOT" {
                self.skip = true;
            }
        } else if key == b"Site" {
            self.current.id = Some(
                String::from_utf8(
                    value
                        .as_bytes()
                        .rsplitn(2, |ch| *ch == b'/')
                        .next()
                        .expect("Site")
                        .to_owned(),
                )
                .expect("Site"),
            );
        } else if key == b"Result" {
            match Outcome::from_ascii(value.as_bytes()) {
                Ok(outcome) => self.current.outcome = Some(outcome),
                Err(_) => self.skip = true,
            }
        } else if key == b"FEN" {
            if value.as_bytes() == b"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" {
                self.current.fen = None;
            } else {
                self.current.fen = Some(value.decode_utf8().expect("FEN").into_owned());
            }
        }
    }

    fn end_headers(&mut self) -> Skip {
        self.skip |= self.current.white.rating.is_none() || self.current.black.rating.is_none();
        Skip(self.skip)
    }

    fn san(&mut self, san: SanPlus) {
        self.current.moves.push(san);
    }

    fn begin_variation(&mut self) -> Skip {
        Skip(true) // stay in the mainline
    }

    fn end_game(&mut self) {
        if !self.skip {
            self.batch.push(mem::take(&mut self.current));
        }

        if self.batch.len() >= self.batch_size {
            self.send();
        }
    }
}

#[tauri::command]
pub async fn convert_pgn(file: PathBuf, app: tauri::AppHandle) {
    // get the name of the file without the extension
    let filename = file.file_stem().expect("file name");
    let extension = file.extension().expect("file extension");
    let db_filename = Path::new("db").join(filename).with_extension("sqlite");

    // export the database to the AppData folder
    let destination = resolve_path(
        &app.config(),
        app.package_info(),
        &app.env(),
        &db_filename,
        Some(BaseDirectory::AppData),
    )
    .expect("resolve path");

    // create a new sqlite database with the name of the file plus the .db extension
    let db = rusqlite::Connection::open(destination).expect("open database");

    // add pragmas to be more performant
    db.execute_batch(
        "PRAGMA journal_mode = OFF;
        PRAGMA synchronous = 0;
        PRAGMA locking_mode = EXCLUSIVE;
        PRAGMA temp_store = MEMORY;",
    )
    .expect("set pragmas");

    db.execute(
        "CREATE TABLE IF NOT EXISTS player (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE
        )",
        [],
    )
    .expect("create players table");

    // create the games table if it doesn't exist
    db.execute(
        "CREATE TABLE IF NOT EXISTS game (
                    id TEXT PRIMARY KEY,
                    white INTEGER NOT NULL,
                    black INTEGER NOT NULL,
                    white_rating INTEGER NOT NULL,
                    black_rating INTEGER NOT NULL,
                    date TEXT NOT NULL,
                    speed INTEGER NOT NULL,
                    fen TEXT,
                    outcome INTEGER NOT NULL,
                    moves TEXT NOT NULL,
                    FOREIGN KEY(white) REFERENCES player(id),
                    FOREIGN KEY(black) REFERENCES player(id)
        )",
        [],
    )
    .expect("create games table");

    let file = File::open(&file).expect("open pgn file");

    let uncompressed: Box<dyn io::Read> = if extension == OsStr::new("bz2") {
        Box::new(bzip2::read::MultiBzDecoder::new(file))
    } else if extension == OsStr::new("zst") {
        Box::new(zstd::Decoder::new(file).expect("zstd decoder"))
    } else {
        Box::new(file)
    };

    let mut reader = BufferedReader::new(uncompressed);
    let mut importer = Importer::new(50, db);
    reader.read_all(&mut importer).expect("read pgn file");
    importer.send();
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
pub fn getDatabaseInfo(file: PathBuf, app: tauri::AppHandle) -> Result<DatabaseInfo, String> {
    // get the db/$file as a PathBuf
    let db_path = PathBuf::from("db").join(file);

    let path = resolve_path(
        &app.config(),
        app.package_info(),
        &app.env(),
        &db_path,
        Some(BaseDirectory::AppData),
    )
    .or(Err("resolve path"))?;

    let db = rusqlite::Connection::open(&path).expect("open database");
    let mut stmt = db
        .prepare("SELECT COUNT(*) FROM player")
        .expect("prepare player count");
    let player_count = stmt
        .query_row([], |row| row.get(0))
        .expect("get player count");

    let mut stmt = db
        .prepare("SELECT COUNT(*) FROM game")
        .expect("prepare game count");
    let game_count = stmt
        .query_row([], |row| row.get(0))
        .expect("get game count");

    let storage_size = path.metadata().expect("get metadata").len() as usize;
    let filename = path.file_name().expect("get filename").to_string_lossy();

    Ok(DatabaseInfo {
        title: "test".to_string(),
        description: filename.to_string(),
        player_count,
        game_count,
        storage_size,
    })
}

#[tauri::command]
pub fn get_number_games(file: PathBuf) -> u64 {
    let db = rusqlite::Connection::open(file).expect("open database");
    db.query_row("SELECT COUNT(*) FROM game", [], |row| row.get(0))
        .expect("count games")
}

#[serde_as]
#[derive(Debug, Clone, Deserialize)]
pub struct GameQuery {
    pub skip_count: bool,
    pub white: Option<String>,
    pub black: Option<String>,
    pub white_rating: Option<(u16, u16)>,
    pub black_rating: Option<(u16, u16)>,
    pub speed: Option<Speed>,
    #[serde_as(as = "Option<DisplayFromStr>")]
    pub outcome: Option<Outcome>,
    pub limit: Option<u64>,
    pub offset: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct QueryResponse<T> {
    pub data: T,
    pub count: Option<usize>,
}

#[tauri::command]
pub async fn get_games(file: PathBuf, query: GameQuery) -> QueryResponse<Vec<Game>> {
    let db = rusqlite::Connection::open(file).expect("open database");

    println!("{:?}", query);
    let count = if query.skip_count {
        None
    } else {
        let mut count_stmt = db
            .prepare(
                "SELECT COUNT(*) FROM game INNER JOIN player AS white ON white.id = game.white
        INNER JOIN player AS black ON black.id = game.black
        WHERE
            (:white IS NULL OR white.name = :white) AND
            (:black IS NULL OR black.name = :black) AND
            (:white_rating_min IS NULL OR white_rating >= :white_rating_min) AND
            (:white_rating_max IS NULL OR white_rating <= :white_rating_max) AND
            (:black_rating_min IS NULL OR black_rating >= :black_rating_min) AND
            (:black_rating_max IS NULL OR black_rating <= :black_rating_max) AND
            (:speed IS NULL OR speed = :speed) AND
            (:outcome IS NULL OR outcome = :outcome)",
            )
            .expect("prepare count statement");

        let mut count_rows = count_stmt
            .query(named_params! {
                ":white": query.white,
                ":black": query.black,
                ":white_rating_min": query.white_rating.map(|(min, _)| min),
                ":white_rating_max": query.white_rating.map(|(_, max)| max),
                ":black_rating_min": query.black_rating.map(|(min, _)| min),
                ":black_rating_max": query.black_rating.map(|(_, max)| max),
                ":speed": query.speed.map(|s| s as u8),
                ":outcome": query.outcome.map(|o| match o {
                    Outcome::Decisive { winner } => match winner {
                        Color::White => 1,
                        Color::Black => 2,
                    },
                    Outcome::Draw => 3,
                })
            })
            .expect("query");

        Some(
            count_rows
                .next()
                .expect("get count")
                .expect("get count")
                .get(0)
                .expect("get count"),
        )
    };
    // get the games that match the query and the total number of games, only up to 10000
    let mut stmt = db
        .prepare(
            "SELECT game.id, white.name, black.name, white_rating, black_rating, date, speed, fen, outcome, moves
            FROM game
            INNER JOIN player AS white ON white.id = game.white
            INNER JOIN player AS black ON black.id = game.black
            WHERE
                (:white IS NULL OR white.name = :white) AND
                (:black IS NULL OR black.name = :black) AND
                (:white_rating_min IS NULL OR white_rating >= :white_rating_min) AND
                (:white_rating_max IS NULL OR white_rating <= :white_rating_max) AND
                (:black_rating_min IS NULL OR black_rating >= :black_rating_min) AND
                (:black_rating_max IS NULL OR black_rating <= :black_rating_max) AND
                (:speed IS NULL OR speed = :speed) AND
                (:outcome IS NULL OR outcome = :outcome)
            LIMIT :limit OFFSET :offset",
        )
        .expect("prepare query");

    let mut rows = stmt
        .query(named_params! {
            ":white": query.white,
            ":black": query.black,
            ":white_rating_min": query.white_rating.map(|(min, _)| min),
            ":white_rating_max": query.white_rating.map(|(_, max)| max),
            ":black_rating_min": query.black_rating.map(|(min, _)| min),
            ":black_rating_max": query.black_rating.map(|(_, max)| max),
            ":speed": query.speed.map(|s| s as u8),
            ":outcome": query.outcome.map(|o| match o {
                Outcome::Decisive { winner } => match winner {
                    Color::White => 1,
                    Color::Black => 2,
                },
                Outcome::Draw => 3,
            }),
            ":limit": query.limit,
            ":offset": query.offset,
        })
        .expect("execute query");

    let mut games = Vec::new();

    while let Some(row) = rows.next().expect("get next row") {
        let id: String = row.get(0).expect("get id");
        let white: String = row.get(1).expect("get white");
        let black: String = row.get(2).expect("get black");
        let white_rating: u16 = row.get(3).expect("get white rating");
        let black_rating: u16 = row.get(4).expect("get black rating");
        let date: String = row.get(5).expect("get date");
        let speed: u8 = row.get(6).expect("get speed");
        let fen: Option<String> = row.get(7).expect("get fen");
        let outcome: u8 = row.get(8).expect("get outcome");

        games.push(Game {
            id: Some(id),
            white: Player {
                name: Some(white),
                rating: Some(white_rating),
            },
            black: Player {
                name: Some(black),
                rating: Some(black_rating),
            },
            date: Some(date),
            speed: Some(Speed::from(speed)),
            fen,
            outcome: Some(match outcome {
                1 => Outcome::Decisive {
                    winner: Color::White,
                },
                2 => Outcome::Decisive {
                    winner: Color::Black,
                },
                3 => Outcome::Draw,
                _ => unreachable!(),
            }),
            moves: Vec::new(),
        });
    }
    QueryResponse { data: games, count }
}

#[derive(Debug, Clone, Deserialize)]
pub struct PlayerQuery {
    pub name: Option<String>,
    pub limit: Option<u64>,
    pub offset: Option<u64>,
}

#[tauri::command]
pub async fn get_players(file: PathBuf, query: PlayerQuery) -> Vec<Player> {
    let db = rusqlite::Connection::open(file).expect("open database");

    // get the players that match the query
    let mut stmt = db
        // Use LIKE
        .prepare(
            "SELECT name
            FROM player
            WHERE
                (:name IS NULL OR name LIKE :name)
            LIMIT :limit OFFSET :offset",
        )
        .expect("prepare query");

    let mut rows = stmt
        .query(named_params! {
            ":name": query.name.map(|n| format!("%{}%", n)),
            ":limit": query.limit,
            ":offset": query.offset,
        })
        .expect("execute query");

    let mut players = Vec::new();

    while let Some(row) = rows.next().expect("get next row") {
        let name: String = row.get(0).expect("get name");

        players.push(Player {
            name: Some(name),
            rating: None,
        });
    }
    players
}
