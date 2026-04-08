//! SQLite store for human-vs-engine games on En Croissant (separate from PGN databases).

use std::collections::HashMap;
use std::path::PathBuf;

use chrono::{NaiveDate, TimeZone, Utc};
use libm::erf;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use shakmaty::{uci::UciMove, Chess, EnPassantMode, Position};
use specta::Type;
use tauri::{AppHandle, Manager};

use crate::db::{GameOutcome, PlayerGameInfo, SiteStatsData, StatsData};
use crate::error::Error;
use crate::opening::get_opening_from_setup;

const DB_FILENAME: &str = "EnCroissantEngineGames.db";

fn db_path(app: &AppHandle) -> Result<PathBuf, Error> {
    let dir = app.path().app_data_dir()?;
    Ok(dir.join(DB_FILENAME))
}

fn open_conn(app: &AppHandle) -> Result<Connection, Error> {
    let path = db_path(app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(&path)?;
    conn.execute_batch(
        "
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS engine_players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL COLLATE NOCASE UNIQUE
        );
        CREATE TABLE IF NOT EXISTS engine_ratings (
            player_id INTEGER NOT NULL,
            perf TEXT NOT NULL,
            rating INTEGER NOT NULL DEFAULT 1000,
            rated_games INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (player_id, perf),
            FOREIGN KEY (player_id) REFERENCES engine_players(id)
        );
        CREATE TABLE IF NOT EXISTS engine_games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_id INTEGER NOT NULL,
            perf TEXT NOT NULL,
            human_was_white INTEGER NOT NULL,
            opponent_elo INTEGER,
            rated INTEGER NOT NULL,
            player_elo_before INTEGER NOT NULL,
            player_elo_after INTEGER NOT NULL,
            result INTEGER NOT NULL,
            time_control TEXT NOT NULL,
            date TEXT NOT NULL,
            opening TEXT NOT NULL,
            FOREIGN KEY (player_id) REFERENCES engine_players(id)
        );
        CREATE INDEX IF NOT EXISTS idx_engine_games_player ON engine_games(player_id);
        ",
    )?;
    Ok(conn)
}

/// Excel `NORM.DIST(Rv, 0, 2000/7, TRUE)` — CDF of Normal(0, σ) at Rv with σ = 2000/7.
fn expected_score(player_elo: f64, opponent_elo: f64) -> f64 {
    let sigma = 2000.0 / 7.0;
    let rv = player_elo - opponent_elo;
    0.5 * (1.0 + erf(rv / (sigma * std::f64::consts::SQRT_2)))
}

fn k_factor(prior_rated_games: i32) -> f64 {
    if prior_rated_games < 25 {
        40.0
    } else if prior_rated_games < 50 {
        20.0
    } else {
        10.0
    }
}

/// Same bucketing as `getTimeControl` for Lichess in the frontend (seconds base + inc).
fn perf_from_time_control(tc: &str) -> &'static str {
    if tc == "-" {
        return "correspondence";
    }
    let mut parts = tc.split('+');
    let initial: f64 = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0.0);
    let increment: f64 = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0.0);
    let total = initial + increment * 40.0;
    if total < 30.0 {
        "ultra_bullet"
    } else if total < 180.0 {
        "bullet"
    } else if total < 480.0 {
        "blitz"
    } else if total < 1500.0 {
        "rapid"
    } else {
        "classical"
    }
}

fn opening_from_uci_moves(moves: &[String]) -> String {
    let mut chess = Chess::default();
    let mut setups = vec![];
    for (i, uci) in moves.iter().enumerate() {
        if i > 54 {
            break;
        }
        let Ok(u) = UciMove::from_ascii(uci.as_bytes()) else {
            break;
        };
        let Ok(m) = u.to_move(&chess) else {
            break;
        };
        chess.play_unchecked(&m);
        setups.push(chess.clone().into_setup(EnPassantMode::Legal));
    }
    setups.reverse();
    setups
        .iter()
        .find_map(|setup| get_opening_from_setup(setup.clone()).ok())
        .unwrap_or_default()
}

fn match_score(outcome: &str, human_is_white: bool) -> Option<f64> {
    match outcome {
        "1-0" => Some(if human_is_white { 1.0 } else { 0.0 }),
        "0-1" => Some(if human_is_white { 0.0 } else { 1.0 }),
        "1/2-1/2" => Some(0.5),
        _ => None,
    }
}

fn outcome_enum(outcome: &str, human_is_white: bool) -> Option<GameOutcome> {
    GameOutcome::from_str(outcome, human_is_white)
}

#[derive(Debug, Clone, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RecordEncroissantEngineGameArgs {
    pub username: String,
    pub human_is_white: bool,
    pub outcome: String,
    pub opponent_elo: Option<i32>,
    pub limit_strength: bool,
    pub time_control: String,
    pub moves_uci: Vec<String>,
    pub date: String,
}

#[tauri::command]
#[specta::specta]
pub async fn record_encroissant_engine_game(
    app: AppHandle,
    args: RecordEncroissantEngineGameArgs,
) -> Result<(), Error> {
    let username = args.username.trim();
    if username.is_empty() {
        return Ok(());
    }

    let Some(m) = match_score(&args.outcome, args.human_is_white) else {
        return Ok(());
    };

    let Some(go) = outcome_enum(&args.outcome, args.human_is_white) else {
        return Ok(());
    };

    let opening = opening_from_uci_moves(&args.moves_uci);
    let perf = perf_from_time_control(&args.time_control).to_string();

    let conn = open_conn(&app)?;
    let tx = conn.unchecked_transaction()?;

    tx.execute(
        "INSERT INTO engine_players (username) VALUES (?1) ON CONFLICT(username) DO NOTHING",
        params![username],
    )?;

    let player_id: i32 = tx.query_row(
        "SELECT id FROM engine_players WHERE username = ?1 COLLATE NOCASE",
        params![username],
        |row| row.get(0),
    )?;

    tx.execute(
        "INSERT INTO engine_ratings (player_id, perf, rating, rated_games)
         VALUES (?1, ?2, 1000, 0)
         ON CONFLICT(player_id, perf) DO NOTHING",
        params![player_id, perf],
    )?;

    let (rating_before, rated_games_before): (i32, i32) = tx.query_row(
        "SELECT rating, rated_games FROM engine_ratings WHERE player_id = ?1 AND perf = ?2",
        params![player_id, perf],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;

    let rated = args.limit_strength && args.opponent_elo.is_some();
    let (rating_after, rated_games_after) = if rated {
        let opp = args.opponent_elo.unwrap() as f64;
        let r = rating_before as f64;
        let p = expected_score(r, opp);
        let k = k_factor(rated_games_before);
        let delta = (m - p) * k;
        let new_r = (r + delta).round() as i32;
        (new_r, rated_games_before + 1)
    } else {
        (rating_before, rated_games_before)
    };

    let result_disc = go as u8 as i32;

    tx.execute(
        "INSERT INTO engine_games (
            player_id, perf, human_was_white, opponent_elo, rated,
            player_elo_before, player_elo_after, result, time_control, date, opening
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            player_id,
            perf,
            args.human_is_white as i32,
            args.opponent_elo,
            i32::from(rated),
            rating_before,
            rating_after,
            result_disc,
            args.time_control,
            args.date,
            opening,
        ],
    )?;

    if rated {
        tx.execute(
            "UPDATE engine_ratings SET rating = ?1, rated_games = ?2
             WHERE player_id = ?3 AND perf = ?4",
            params![rating_after, rated_games_after, player_id, perf],
        )?;
    }

    tx.commit()?;
    Ok(())
}

fn decode_game_outcome(result: i32) -> Option<GameOutcome> {
    match result {
        0 => Some(GameOutcome::Won),
        1 => Some(GameOutcome::Drawn),
        2 => Some(GameOutcome::Lost),
        _ => None,
    }
}

/// En Croissant stats for a username. `None` if they are not in the local engine player directory.
pub fn load_site_stats(app: &AppHandle, username: &str) -> Result<Option<SiteStatsData>, Error> {
    let username = username.trim();
    if username.is_empty() {
        return Ok(None);
    }

    let conn = open_conn(app)?;
    let player_id: Option<i32> = match conn.query_row(
        "SELECT id FROM engine_players WHERE username = ?1 COLLATE NOCASE",
        params![username],
        |row| row.get(0),
    ) {
        Ok(id) => Some(id),
        Err(rusqlite::Error::QueryReturnedNoRows) => None,
        Err(e) => return Err(e.into()),
    };

    let Some(pid) = player_id else {
        return Ok(None);
    };

    let canonical: String = conn.query_row(
        "SELECT username FROM engine_players WHERE id = ?1",
        params![pid],
        |row| row.get(0),
    )?;

    let mut stmt = conn.prepare(
        "SELECT human_was_white, player_elo_after, result, time_control, date, opening
         FROM engine_games WHERE player_id = ?1 ORDER BY date ASC, id ASC",
    )?;

    let rows = stmt.query_map(params![pid], |row| {
        Ok((
            row.get::<_, i32>(0)?,
            row.get::<_, i32>(1)?,
            row.get::<_, i32>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, String>(5)?,
        ))
    })?;

    let mut data = Vec::new();
    for r in rows {
        let (hw, elo, res, tc, d, op) = r?;
        if let Some(go) = decode_game_outcome(res) {
            data.push(StatsData {
                date: d,
                is_player_white: hw != 0,
                player_elo: elo,
                result: go,
                time_control: tc,
                opening: op,
            });
        }
    }

    Ok(Some(SiteStatsData {
        site: "En Croissant".to_string(),
        player: canonical,
        data,
    }))
}

pub fn merge_encroissant_into_player_info(
    app: &AppHandle,
    player_name: &str,
    info: &mut PlayerGameInfo,
) -> Result<(), Error> {
    if let Some(extra) = load_site_stats(app, player_name)? {
        info.site_stats_data.push(extra);
    }
    Ok(())
}

/// Current En Croissant engine rating for this username and time-control bucket, or 1000 if new.
pub fn display_rating_for_username_tc(
    app: &AppHandle,
    username: &str,
    time_control: &str,
) -> Result<i32, Error> {
    let username = username.trim();
    if username.is_empty() {
        return Ok(1000);
    }
    let perf = perf_from_time_control(time_control).to_string();
    let conn = open_conn(app)?;
    let player_id: Option<i32> = match conn.query_row(
        "SELECT id FROM engine_players WHERE username = ?1 COLLATE NOCASE",
        params![username],
        |row| row.get(0),
    ) {
        Ok(id) => Some(id),
        Err(rusqlite::Error::QueryReturnedNoRows) => None,
        Err(e) => return Err(e.into()),
    };
    let Some(pid) = player_id else {
        return Ok(1000);
    };
    let rating: Result<i32, rusqlite::Error> = conn.query_row(
        "SELECT rating FROM engine_ratings WHERE player_id = ?1 AND perf = ?2",
        params![pid, perf],
        |row| row.get(0),
    );
    match rating {
        Ok(r) => Ok(r),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(1000),
        Err(e) => Err(e.into()),
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GetEncDisplayRatingArgs {
    pub username: String,
    pub time_control: String,
}

#[tauri::command]
#[specta::specta]
pub async fn get_encroissant_engine_display_rating(
    app: AppHandle,
    args: GetEncDisplayRatingArgs,
) -> Result<i32, Error> {
    display_rating_for_username_tc(&app, &args.username, &args.time_control)
}

#[tauri::command]
#[specta::specta]
pub async fn get_encroissant_engine_site_stats(
    app: AppHandle,
    username: String,
) -> Result<Option<SiteStatsData>, Error> {
    load_site_stats(&app, &username)
}

/// Ensures a row exists in the En Croissant engine player directory (0 games until recorded).
#[tauri::command]
#[specta::specta]
pub async fn register_encroissant_engine_player(app: AppHandle, username: String) -> Result<(), Error> {
    let username = username.trim();
    if username.is_empty() {
        return Ok(());
    }
    let conn = open_conn(&app)?;
    conn.execute(
        "INSERT INTO engine_players (username) VALUES (?1) ON CONFLICT(username) DO NOTHING",
        params![username],
    )?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct EncEnginePerfStat {
    pub key: String,
    pub rating: i32,
    pub games: i32,
}

#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct EncEngineAccountSummary {
    pub registered: bool,
    pub username: String,
    pub total_games: i32,
    pub last_played_at_ms: Option<i64>,
    pub perfs: Vec<EncEnginePerfStat>,
}

fn pgn_date_to_ms(s: &str) -> Option<i64> {
    let d = NaiveDate::parse_from_str(s.trim(), "%Y.%m.%d").ok()?;
    let ndt = d.and_hms_opt(0, 0, 0)?;
    Some(Utc.from_utc_datetime(&ndt).timestamp_millis())
}

fn rating_for_perf_or_default(
    conn: &Connection,
    player_id: i32,
    perf: &str,
) -> Result<i32, rusqlite::Error> {
    match conn.query_row(
        "SELECT rating FROM engine_ratings WHERE player_id = ?1 AND perf = ?2",
        params![player_id, perf],
        |row| row.get::<_, i32>(0),
    ) {
        Ok(r) => Ok(r),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(1000),
        Err(e) => Err(e),
    }
}

pub fn enc_engine_account_summary(app: &AppHandle, username: &str) -> Result<EncEngineAccountSummary, Error> {
    let username = username.trim();
    if username.is_empty() {
        return Ok(EncEngineAccountSummary {
            registered: false,
            username: String::new(),
            total_games: 0,
            last_played_at_ms: None,
            perfs: vec![],
        });
    }

    let conn = open_conn(app)?;
    let player_id: Option<i32> = match conn.query_row(
        "SELECT id FROM engine_players WHERE username = ?1 COLLATE NOCASE",
        params![username],
        |row| row.get(0),
    ) {
        Ok(id) => Some(id),
        Err(rusqlite::Error::QueryReturnedNoRows) => None,
        Err(e) => return Err(e.into()),
    };

    let Some(pid) = player_id else {
        return Ok(EncEngineAccountSummary {
            registered: false,
            username: username.to_string(),
            total_games: 0,
            last_played_at_ms: None,
            perfs: vec![],
        });
    };

    let canonical: String = conn.query_row(
        "SELECT username FROM engine_players WHERE id = ?1",
        params![pid],
        |row| row.get(0),
    )?;

    let total_games: i32 = conn.query_row(
        "SELECT COUNT(*) FROM engine_games WHERE player_id = ?1",
        params![pid],
        |row| row.get(0),
    )?;

    let mut dates: Vec<String> = conn
        .prepare("SELECT date FROM engine_games WHERE player_id = ?1")?
        .query_map(params![pid], |row| row.get::<_, String>(0))?
        .filter_map(|r| r.ok())
        .collect();

    dates.sort_by(|a, b| b.cmp(a));
    let last_played_at_ms = dates.first().and_then(|s| pgn_date_to_ms(s));

    let mut counts: HashMap<String, i32> = HashMap::new();
    let mut stmt = conn.prepare("SELECT perf, COUNT(*) FROM engine_games WHERE player_id = ?1 GROUP BY perf")?;
    let rows = stmt.query_map(params![pid], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i32>(1)?))
    })?;
    for r in rows {
        let (perf, n) = r?;
        counts.insert(perf, n);
    }

    let bullet_games = *counts.get("bullet").unwrap_or(&0) + *counts.get("ultra_bullet").unwrap_or(&0);
    let blitz_games = *counts.get("blitz").unwrap_or(&0);
    let rapid_games = *counts.get("rapid").unwrap_or(&0);
    let classical_games = *counts.get("classical").unwrap_or(&0);

    let bullet_rating = rating_for_perf_or_default(&conn, pid, "bullet")?;
    let blitz_rating = rating_for_perf_or_default(&conn, pid, "blitz")?;
    let rapid_rating = rating_for_perf_or_default(&conn, pid, "rapid")?;
    let classical_rating = rating_for_perf_or_default(&conn, pid, "classical")?;

    let perfs = vec![
        EncEnginePerfStat {
            key: "bullet".to_string(),
            rating: bullet_rating,
            games: bullet_games,
        },
        EncEnginePerfStat {
            key: "blitz".to_string(),
            rating: blitz_rating,
            games: blitz_games,
        },
        EncEnginePerfStat {
            key: "rapid".to_string(),
            rating: rapid_rating,
            games: rapid_games,
        },
        EncEnginePerfStat {
            key: "classical".to_string(),
            rating: classical_rating,
            games: classical_games,
        },
    ];

    Ok(EncEngineAccountSummary {
        registered: true,
        username: canonical,
        total_games,
        last_played_at_ms,
        perfs,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn get_encroissant_engine_account_summary(
    app: AppHandle,
    username: String,
) -> Result<EncEngineAccountSummary, Error> {
    enc_engine_account_summary(&app, &username)
}

#[tauri::command]
#[specta::specta]
pub async fn list_encroissant_engine_usernames(app: AppHandle) -> Result<Vec<String>, Error> {
    let conn = open_conn(&app)?;
    let mut stmt = conn.prepare("SELECT username FROM engine_players ORDER BY username COLLATE NOCASE")?;
    let names = stmt
        .query_map([], |row| row.get(0))?
        .filter_map(|r| r.ok())
        .collect();
    Ok(names)
}
