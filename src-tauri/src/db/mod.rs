mod models;
mod ocgdb;
mod schema;
use crate::{
    db::{models::*, ocgdb::decode_moves, schema::*},
    AppState,
};
use diesel::{
    connection::SimpleConnection,
    prelude::*,
    r2d2::{ConnectionManager, Pool},
};
use serde::{Deserialize, Serialize};
use std::{path::PathBuf, time::Duration};
use tauri::State;
use tauri::{
    api::path::{resolve_path, BaseDirectory},
    Manager,
};

#[derive(Debug)]
pub struct ConnectionOptions {
    pub enable_wal: bool,
    pub enable_foreign_keys: bool,
    pub busy_timeout: Option<Duration>,
}

impl diesel::r2d2::CustomizeConnection<SqliteConnection, diesel::r2d2::Error>
    for ConnectionOptions
{
    fn on_acquire(&self, conn: &mut SqliteConnection) -> Result<(), diesel::r2d2::Error> {
        (|| {
            if self.enable_wal {
                conn.batch_execute("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;")?;
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
) -> Result<diesel::r2d2::Pool<diesel::r2d2::ConnectionManager<diesel::SqliteConnection>>, String> {
    let mut state = app_state.0.lock().unwrap();
    if state.contains_key(db_path) {
        Ok(state.get(db_path).unwrap().clone())
    } else {
        let pool = Pool::builder()
            .max_size(16)
            .connection_customizer(Box::new(ConnectionOptions {
                enable_wal: true,
                enable_foreign_keys: true,
                busy_timeout: Some(Duration::from_secs(30)),
            }))
            .build(ConnectionManager::<SqliteConnection>::new(db_path))
            .map_err(|err| err.to_string())?;
        state.insert(db_path.to_string(), pool.clone());
        Ok(pool)
    }
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
pub async fn get_db_info(file: PathBuf, app: tauri::AppHandle) -> Result<DatabaseInfo, String> {
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
        .prepare("SELECT Value FROM Info WHERE Name = 'PlayerCount'")
        .expect("prepare player count");
    let player_count: String = stmt
        .query_row([], |row| row.get(0))
        .expect("get player count");

    let mut stmt = db
        .prepare("SELECT Value FROM Info WHERE Name = 'GameCount'")
        .expect("prepare game count");
    let game_count: String = stmt
        .query_row([], |row| row.get(0))
        .expect("get game count");

    // get the title from the metadata table
    // let mut stmt = db
    //     .prepare("SELECT value FROM metadata WHERE key = 'title'")
    //     .expect("prepare title");
    // let title = stmt.query_row([], |row| row.get(0)).expect("get title");
    let title = "Untitled".to_string();

    let storage_size = path.metadata().expect("get metadata").len() as usize;
    let filename = path.file_name().expect("get filename").to_string_lossy();

    Ok(DatabaseInfo {
        title,
        description: filename.to_string(),
        player_count: player_count.parse().expect("parse player count"),
        game_count: game_count.parse().expect("parse game count"),
        storage_size,
    })
}

#[tauri::command]
pub async fn rename_db(file: PathBuf, title: String) -> Result<(), String> {
    let db = rusqlite::Connection::open(file).expect("open database");
    db.execute("UPDATE metadata SET value = ? WHERE key = 'title'", [title])
        .expect("update title");
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
    let pool = get_db_or_create(&state, &file.to_str().unwrap())?;
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
            event: event,
            site: site,
            date: game.date,
            round: game.round,
            white: white,
            white_elo: game.white_elo,
            black: black,
            black_elo: game.black_elo,
            result: game.result,
            time_control: game.time_control,
            eco: game.eco,
            ply_count: game.ply_count,
            fen: game.fen,
            moves: decode_moves(game.moves2).unwrap_or(String::new()),
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
    let pool = get_db_or_create(&state, &file.to_str().unwrap())?;
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

// #[tauri::command]
// pub async fn get_players_game_info(
//     file: PathBuf,
//     id: i32,
//     state: tauri::State<'_, AppState>,
// ) -> Result<PlayerGameInfo, String> {
//     let pool = get_db_or_create(&state, &file.to_str().unwrap())?;
//     let db = &mut pool.get().unwrap();

//     let sql_query = games::table
//         .group_by(games::Result)
//         .select((games::Result, diesel::dsl::count(games::ID)))
//         .filter(games::white_id.eq(id).or(games::black_id.eq(id)));

//     let info: Vec<(Option<CustomOutcome>, i64)> = sql_query.load(db).expect("load games");

//     let mut game_info = PlayerGameInfo {
//         won: 0,
//         lost: 0,
//         draw: 0,
//     };

//     for (outcome, count) in info {
//         match outcome {
//             Some(CustomOutcome::WhiteWin) => game_info.won = count as usize,
//             Some(CustomOutcome::BlackWin) => game_info.lost = count as usize,
//             Some(CustomOutcome::Draw) => game_info.draw = count as usize,
//             _ => (),
//         }
//     }

//     Ok(game_info)
// }

// #[tauri::command]
// pub async fn search_opening(
//     file: PathBuf,
//     opening: String,
//     state: tauri::State<'_, AppState>,
// ) -> Result<Vec<(Game, Player, Player)>, String> {
//     let pool = get_db_or_create(&state, &file.to_str().unwrap())?;
//     let db = &mut pool.get().unwrap();

//     println!("searching for opening: {}", opening);

//     let (white_players, black_players) = diesel::alias!(players as white, players as black);

//     let games = games::table
//         .inner_join(white_players.on(games::white_id.eq(white_players.field(players::id))))
//         .inner_join(black_players.on(games::black_id.eq(black_players.field(players::id))))
//         .into_boxed()
//         .filter(games::moves.like(format!("{}%", opening)))
//         .order(games::max_rating.desc())
//         .limit(10)
//         .load(db)
//         .expect("load games");

//     Ok(games)
// }
