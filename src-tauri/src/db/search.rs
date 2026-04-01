use serde::{Deserialize, Serialize};
use shakmaty::{fen::Fen, san::SanPlus, uci::UciMove, CastlingMode, Chess, Position, Setup};
use specta::Type;
use std::path::PathBuf;

use crate::{
    db::{get_material_count, get_pawn_home, models::*, MaterialCount},
    error::Error,
    AppState,
};

use super::{get_duckdb_pool, load_aixchess_extension, GameQuery};

#[derive(Debug, Hash, PartialEq, Eq, Clone)]
pub struct ExactData {
    pawn_home: u16,
    material: MaterialCount,
    position: Chess,
}

#[derive(Debug, Hash, PartialEq, Eq, Clone)]
pub struct PartialData {
    // piece_counts: Vec<(Piece, u8)>,
    piece_positions: Setup,
    material: MaterialCount,
}

#[derive(Debug, Hash, PartialEq, Eq, Clone)]
pub enum PositionQuery {
    Exact(ExactData),
    Partial(PartialData),
}

impl PositionQuery {
    pub fn exact_from_fen(fen: &str) -> Result<PositionQuery, Error> {
        let fen = Fen::from_ascii(fen.as_bytes())?;
        let setup = fen.into_setup();
        let castling_mode = CastlingMode::detect(&setup);
        let position: Chess = setup.position(castling_mode)?;
        let pawn_home = get_pawn_home(position.board());
        let material = get_material_count(position.board());
        Ok(PositionQuery::Exact(ExactData {
            pawn_home,
            material,
            position,
        }))
    }

    pub fn partial_from_fen(fen: &str) -> Result<PositionQuery, Error> {
        let fen = Fen::from_ascii(fen.as_bytes())?;
        let setup = fen.into_setup();
        let material = get_material_count(&setup.board);
        Ok(PositionQuery::Partial(PartialData {
            piece_positions: setup,
            material,
        }))
    }
}

#[derive(Debug, Clone, Deserialize, Type, PartialEq, Eq, Hash)]
pub struct PositionQueryJs {
    pub fen: String,
    pub type_: String,
}

fn convert_position_query(query: PositionQueryJs) -> Result<PositionQuery, Error> {
    match query.type_.as_str() {
        "exact" => PositionQuery::exact_from_fen(&query.fen),
        "partial" => PositionQuery::partial_from_fen(&query.fen),
        _ => unreachable!(),
    }
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

fn build_position_where_clauses(
    query: &GameQuery,
    position_type: &str,
    full_fen: &str,
) -> Vec<String> {
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
        clauses.push(format!("date >= {}", sql_literal(start_date)));
    }

    if let Some(end_date) = query.end_date.as_deref() {
        clauses.push(format!("date <= {}", sql_literal(end_date)));
    }

    if position_type == "exact" && full_fen.split_whitespace().count() >= 2 {
        clauses.push(format!("matches_fen(movedata, {})", sql_literal(full_fen)));
    }

    clauses
}

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

    let parsed_query = convert_position_query(position_query.clone())?;
    let fen = Fen::from_ascii(position_query.fen.as_bytes())?;
    let setup = fen.into_setup();
    let castling_mode = CastlingMode::detect(&setup);
    let reference_position = setup.position(castling_mode)?;

    let (position_type, sub_fen) = match parsed_query {
        PositionQuery::Exact(data) => ("exact", data.position.board().to_string()),
        PositionQuery::Partial(data) => ("partial", data.piece_positions.board.to_string()),
    };

    let db_pool = get_duckdb_pool(&state, &file)?;
    let db = db_pool.get()?;
    load_aixchess_extension(&db)?;

    let where_clauses = build_position_where_clauses(&query, position_type, &position_query.fen);

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let sql = if position_type == "exact" {
        format!(
            "WITH matching_positions AS (
                SELECT movedata, result, matches_fen_ply(movedata, {full_fen}) AS ply
                FROM games
                {where_clause}
            )
            SELECT
                CASE
                    WHEN move_details_at(movedata, ply::SMALLINT).\"from\" IS NULL
                        OR move_details_at(movedata, ply::SMALLINT).\"to\" IS NULL
                    THEN '*'
                    ELSE
                        move_details_at(movedata, ply::SMALLINT).\"from\" ||
                        move_details_at(movedata, ply::SMALLINT).\"to\" ||
                        COALESCE(move_details_at(movedata, ply::SMALLINT).promotion, '')
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
        )
    } else {
        let sub_fen_query = format!(r#"{{"sub-fen": "{}"}}"#, sub_fen);
        format!(
            "WITH candidate_games AS (
                SELECT movedata, result, scoutfish_query_plies(movedata, {sub_fen_json}) AS plies
                FROM games
                {where_clause}
            ), matching_positions AS (
                SELECT UNNEST(plies) AS ply, movedata, result
                FROM candidate_games
            )
            SELECT
                CASE
                    WHEN move_details_at(movedata, ply::SMALLINT).\"from\" IS NULL
                        OR move_details_at(movedata, ply::SMALLINT).\"to\" IS NULL
                    THEN '*'
                    ELSE
                        move_details_at(movedata, ply::SMALLINT).\"from\" ||
                        move_details_at(movedata, ply::SMALLINT).\"to\" ||
                        COALESCE(move_details_at(movedata, ply::SMALLINT).promotion, '')
                END AS next_move,
                COUNT(*) AS total_games,
                SUM(CASE WHEN result = '1-0' THEN 1 ELSE 0 END) AS white_wins,
                SUM(CASE WHEN result = '0-1' THEN 1 ELSE 0 END) AS black_wins,
                SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) AS draws
            FROM matching_positions
            GROUP BY next_move
            ORDER BY total_games DESC;",
            sub_fen_json = sql_literal(&sub_fen_query),
            where_clause = where_sql,
        )
    };

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

    let parsed_query = convert_position_query(position_query.clone())?;
    let position_type = match parsed_query {
        PositionQuery::Exact(data) => ("exact", data.position.board().to_string()),
        PositionQuery::Partial(data) => ("partial", data.piece_positions.board.to_string()),
    }
    .0;

    let db_pool = get_duckdb_pool(&state, &file)?;
    let db = db_pool.get()?;
    load_aixchess_extension(&db)?;

    let where_clauses = build_position_where_clauses(&query, position_type, &position_query.fen);

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
