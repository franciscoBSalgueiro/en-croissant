use serde::{Deserialize, Serialize};
use shakmaty::{fen::Fen, san::SanPlus, uci::UciMove, CastlingMode, Chess};
use specta::Type;
use std::path::PathBuf;

use crate::{db::models::*, error::Error, AppState};

use super::{get_duckdb_pool, GameQuery, Sides};

#[derive(Debug, Clone, Deserialize, Type, PartialEq, Eq, Hash)]
pub struct PositionQueryJs {
    pub fen: String,
    pub type_: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Type)]
pub struct PositionStats {
    #[serde(rename = "move")]
    pub move_: String,
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

fn build_position_where_clauses(query: &GameQuery, full_fen: &str) -> Vec<String> {
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

    match query.sides.as_ref() {
        Some(Sides::WhiteBlack) => {
            if let Some(player1) = query.player1.as_deref() {
                clauses.push(format!("white = {}", sql_literal(player1)));
            }
            if let Some(player2) = query.player2.as_deref() {
                clauses.push(format!("black = {}", sql_literal(player2)));
            }
        }
        Some(Sides::BlackWhite) => {
            if let Some(player1) = query.player1.as_deref() {
                clauses.push(format!("black = {}", sql_literal(player1)));
            }
            if let Some(player2) = query.player2.as_deref() {
                clauses.push(format!("white = {}", sql_literal(player2)));
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
        }
        None => {
            if let Some(player1) = query.player1.as_deref() {
                clauses.push(format!("white = {}", sql_literal(player1)));
            }
            if let Some(player2) = query.player2.as_deref() {
                clauses.push(format!("black = {}", sql_literal(player2)));
            }
        }
    }

    if full_fen.split_whitespace().count() >= 2 && Fen::from_ascii(full_fen.as_bytes()).is_ok() {
        clauses.push(format!(
            "matches_fen(movedata, {}, fen)",
            sql_literal(full_fen)
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
    let reference_position = setup.position(castling_mode)?;

    let db_pool = get_duckdb_pool(&state, &file)?;
    let db = db_pool.get()?;

    let where_clauses = build_position_where_clauses(&query, &position_query.fen);

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let sql = format!(
        "WITH matching_positions AS (
            SELECT movedata, result, fen, matches_fen_ply(movedata, {full_fen}, fen) AS ply
            FROM games
            {where_clause}
        )
        SELECT
            CASE
                WHEN move_details_at(movedata, ply::SMALLINT, fen).\"from\" IS NULL
                    OR move_details_at(movedata, ply::SMALLINT, fen).\"to\" IS NULL
                THEN '*'
                ELSE
                    move_details_at(movedata, ply::SMALLINT, fen).\"from\" ||
                    move_details_at(movedata, ply::SMALLINT, fen).\"to\" ||
                    COALESCE(move_details_at(movedata, ply::SMALLINT, fen).promotion, '')
            END AS next_move,
            COUNT(*) AS total_games,
            SUM(CASE WHEN result = '1-0' THEN 1 ELSE 0 END) AS white_wins,
            SUM(CASE WHEN result = '0-1' THEN 1 ELSE 0 END) AS black_wins,
            SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) AS draws
        FROM matching_positions
        WHERE ply IS NOT NULL
        GROUP BY next_move
        ORDER BY total_games DESC;",
        full_fen = sql_literal(&position_query.fen),
        where_clause = where_sql,
    );

    // println!("Executing SQL:\n{sql}");

    let openings = db
        .prepare(&sql)?
        .query_map([], |row| {
            Ok(PositionStats {
                move_: row.get::<_, String>("next_move")?,
                white: row.get::<_, i32>("white_wins")?,
                draw: row.get::<_, i32>("draws")?,
                black: row.get::<_, i32>("black_wins")?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .map(|mut stat| {
            stat.move_ = uci_to_san(&stat.move_, &reference_position);
            stat
        })
        .collect();

    Ok((openings, vec![]))
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

    let where_clauses = build_position_where_clauses(&query, &position_query.fen);

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
