use serde::{Deserialize, Serialize};
use shakmaty::{
    fen::{Epd, Fen},
    san::SanPlus,
    uci::UciMove,
    CastlingMode, Chess, EnPassantMode,
};
use specta::Type;
use std::{
    collections::{HashMap, VecDeque},
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};

use crate::{db::models::*, error::Error, AppState};

use super::{duckdb_pool_key, get_duckdb_pool, Connection, GameQuery, Sides};

const POSITION_CACHE_CAPACITY: usize = 4096;

#[derive(Default)]
pub(crate) struct PositionCache {
    entries: HashMap<String, Vec<PositionStats>>,
    order: VecDeque<String>,
}

impl PositionCache {
    fn get_or_compute(
        &mut self,
        key: String,
        compute: impl FnOnce() -> Result<Vec<PositionStats>, Error>,
    ) -> Result<Vec<PositionStats>, Error> {
        if let Some(stats) = self.entries.get(&key) {
            return Ok(stats.clone());
        }
        let stats = compute()?;
        if self.entries.len() == POSITION_CACHE_CAPACITY {
            if let Some(oldest) = self.order.pop_front() {
                self.entries.remove(&oldest);
            }
        }
        self.order.push_back(key.clone());
        self.entries.insert(key, stats.clone());
        Ok(stats)
    }
}

pub(super) fn position_cache(state: &AppState, path: &Path) -> Arc<Mutex<PositionCache>> {
    state
        .position_caches
        .entry(duckdb_pool_key(path))
        .or_insert_with(|| Arc::new(Mutex::new(PositionCache::default())))
        .clone()
}

fn position_cache_key(position: &Chess, where_sql: &str) -> String {
    format!(
        "{}|{}",
        Epd::from_position(position, EnPassantMode::Legal),
        where_sql
    )
}

const INITIAL_FEN: &str = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

#[derive(Debug, Clone, Deserialize, Type, PartialEq, Eq, Hash)]
pub struct PositionQueryJs {
    pub fen: String,
    pub type_: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Type)]
pub struct PositionStats {
    #[serde(rename = "move")]
    pub move_: String,
    pub total: i32,
    pub white: i32,
    pub draw: i32,
    pub black: i32,
}

fn sql_literal(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

fn map_wanted_result_filter(value: &str) -> Option<&'static str> {
    match value {
        "whitewon" => Some("1-0"),
        "blackwon" => Some("0-1"),
        "draw" => Some("1/2-1/2"),
        _ => None,
    }
}

fn uci_to_san(uci_move: &str, position: &Chess) -> String {
    if uci_move == "*" {
        return uci_move.to_string();
    }

    let Ok(uci) = UciMove::from_ascii(uci_move.as_bytes()) else {
        return uci_move.to_string();
    };

    let Ok(chess_move) = uci.to_move(position) else {
        return uci_move.to_string();
    };

    SanPlus::from_move(position.clone(), chess_move).to_string()
}

fn build_position_where_clauses(query: &GameQuery, full_fen: Option<&str>) -> Vec<String> {
    let mut clauses = Vec::new();

    if let Some(outcome) = query.outcome.as_deref() {
        clauses.push(format!("result = {}", sql_literal(outcome)));
    }

    if let Some(wanted_result) = query
        .wanted_result
        .as_deref()
        .and_then(map_wanted_result_filter)
    {
        clauses.push(format!("result = {}", sql_literal(wanted_result)));
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
            let player1 = query.player1.as_deref();
            let player2 = query.player2.as_deref();

            match (player1, player2) {
                (Some(player1), Some(player2)) => {
                    let p1 = sql_literal(player1);
                    let p2 = sql_literal(player2);
                    clauses.push(format!(
                        "((white = {p1} AND black = {p2}) OR (white = {p2} AND black = {p1}))"
                    ));
                }
                (Some(player1), None) => {
                    let p1 = sql_literal(player1);
                    clauses.push(format!("(white = {p1} OR black = {p1})"));
                }
                (None, Some(player2)) => {
                    let p2 = sql_literal(player2);
                    clauses.push(format!("(white = {p2} OR black = {p2})"));
                }
                (None, None) => {}
            }

            if let (Some(range1), Some(range2)) = (query.range1, query.range2) {
                clauses.push(format!(
                    "((white_rating BETWEEN {} AND {}) OR (black_rating BETWEEN {} AND {}) OR (white_rating BETWEEN {} AND {}) OR (black_rating BETWEEN {} AND {}))",
                    range1.0,
                    range1.1,
                    range1.0,
                    range1.1,
                    range2.0,
                    range2.1,
                    range2.0,
                    range2.1,
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
        None => {
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
    }

    if let Some(full_fen) = full_fen.filter(|fen| {
        fen.split_whitespace().count() >= 2 && Fen::from_ascii(fen.as_bytes()).is_ok()
    }) {
        clauses.push(format!(
            "matches_fen(movedata, {}, COALESCE(fen, {}))",
            sql_literal(full_fen),
            sql_literal(INITIAL_FEN)
        ));
    }

    clauses
}

#[allow(dead_code)]
#[derive(Clone, serde::Serialize)]
pub struct ProgressPayload {
    pub progress: f64,
    pub id: String,
    pub finished: bool,
}

#[tauri::command]
#[specta::specta]
pub async fn search_position(
    file: PathBuf,
    query: GameQuery,
    _app: tauri::AppHandle,
    _tab_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(Vec<PositionStats>, Vec<NormalizedGame>), Error> {
    let Some(position_query) = query.position.clone() else {
        return Ok((vec![], vec![]));
    };

    if position_query.type_ != "exact" {
        return Ok((vec![], vec![]));
    }

    let fen = Fen::from_ascii(position_query.fen.as_bytes())?;
    let setup = fen.into_setup();
    let castling_mode = CastlingMode::detect(&setup);
    let reference_position: Chess = setup.position(castling_mode)?;

    let db_pool = get_duckdb_pool(&state, &file)?;
    let cache = position_cache(&state, &file);

    let where_clauses = build_position_where_clauses(&query, None);

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let matching_positions = format!(
        "SELECT result, next_move_at_fen(movedata, {}, fen) AS next_move FROM games {where_sql}",
        sql_literal(&position_query.fen),
    );

    let key = position_cache_key(&reference_position, &where_sql);
    tokio::task::spawn_blocking(move || {
        let mut cache = cache
            .lock()
            .map_err(|_| std::io::Error::other("position cache mutex poisoned"))?;
        let openings = cache.get_or_compute(key, || {
            let db = db_pool.get()?;
            let openings = query_position_stats(&db, &matching_positions)?
                .into_iter()
                .map(|mut stat| {
                    stat.move_ = uci_to_san(&stat.move_, &reference_position);
                    stat
                })
                .collect();
            Ok(openings)
        })?;

        Ok((openings, vec![]))
    })
    .await
    .map_err(|err| std::io::Error::other(err.to_string()))?
}

fn query_position_stats(
    db: &Connection,
    matching_positions: &str,
) -> Result<Vec<PositionStats>, Error> {
    let sql = format!(
        "WITH matching_positions AS ({matching_positions})
        SELECT next_move,
            COUNT(*) AS total_games,
            SUM(CASE WHEN result = '1-0' THEN 1 ELSE 0 END) AS white_wins,
            SUM(CASE WHEN result = '0-1' THEN 1 ELSE 0 END) AS black_wins,
            SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) AS draws
        FROM matching_positions
        WHERE next_move IS NOT NULL
        GROUP BY next_move
        ORDER BY total_games DESC;"
    );
    let openings = db
        .prepare(&sql)?
        .query_map([], |row| {
            Ok(PositionStats {
                move_: row.get("next_move")?,
                total: row.get("total_games")?,
                white: row.get("white_wins")?,
                draw: row.get("draws")?,
                black: row.get("black_wins")?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(openings)
}

pub async fn is_position_in_db(
    file: PathBuf,
    query: GameQuery,
    state: tauri::State<'_, AppState>,
) -> Result<bool, Error> {
    let Some(position_query) = query.position.clone() else {
        return Ok(false);
    };

    if position_query.type_ != "exact" {
        return Ok(false);
    }

    let db_pool = get_duckdb_pool(&state, &file)?;
    let db = db_pool.get()?;

    let where_clauses = build_position_where_clauses(&query, Some(&position_query.fen));

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let sql = format!(
        "SELECT EXISTS(SELECT 1 FROM games {where_clause} LIMIT 1);",
        where_clause = where_sql,
    );

    let exists = db.query_row(&sql, [], |row| row.get::<_, bool>(0))?;
    Ok(exists)
}
