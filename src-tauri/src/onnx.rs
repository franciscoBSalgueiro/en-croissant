use std::path::PathBuf;

use maia_rust::Maia;
use serde::{Deserialize, Serialize};
use shakmaty::{san::SanPlus, uci::UciMove, EnPassantMode, Position};
use specta::Type;
use vampirc_uci::uci::{Score, ScoreValue};

use crate::{chess::BestMoves, engine::parse_fen_and_apply_moves, error::Error, AppState};

/// Call once at process startup, before any ONNX session is created.
pub fn init_ort_log_level() {
    if let Ok(env) = ort::environment::current() {
        env.set_log_level(ort::logging::LogLevel::Warning);
    }
}

#[derive(Debug, Clone, Serialize, Type)]
pub struct MoveProbability {
    pub uci: String,
    pub probability: f32,
}

#[derive(Debug, Clone, Serialize, Type)]
pub struct EvaluationResult {
    pub policy: Vec<MoveProbability>,
    /// WDL is for the current position, not per policy move.
    pub white_wr: f32,
    pub draw: f32,
    pub black_wr: f32,
}

#[derive(Debug, Clone, Deserialize, Type)]
pub struct MaiaEvalPosition {
    pub fen: String,
    pub moves: Vec<String>,
}

impl From<maia_rust::MoveProbability> for MoveProbability {
    fn from(value: maia_rust::MoveProbability) -> Self {
        Self {
            uci: value.uci.to_string(),
            probability: value.probability,
        }
    }
}

impl From<maia_rust::EvaluationResult> for EvaluationResult {
    fn from(value: maia_rust::EvaluationResult) -> Self {
        Self {
            policy: value.policy.into_iter().map(Into::into).collect(),
            white_wr: value.white_wr,
            draw: value.draw,
            black_wr: value.black_wr,
        }
    }
}

pub fn wdl_to_cp(win: f32, draw: f32) -> i32 {
    let expected_score = win + draw / 2.0;
    let q = 2.0 * expected_score - 1.0;
    (111.71464 * (1.5620688 * q).tan()).round() as i32
}

#[tauri::command]
#[specta::specta]
pub async fn maia_eval(
    id: String,
    model_path: PathBuf,
    tab: String,
    fen: String,
    moves: Vec<String>,
    elo: f32,
    state: tauri::State<'_, AppState>,
) -> Result<EvaluationResult, Error> {
    let mut maia = state
        .maia_sessions
        .entry((tab, id))
        .or_try_insert_with(|| Maia::from_file(model_path))?;
    let pos = parse_fen_and_apply_moves(&fen, &moves)?.to_setup(EnPassantMode::Always);
    let opts = ort::session::RunOptions::new().unwrap();
    let results = maia
        .batch_evaluate_async([pos], &[elo], &[elo], &opts)
        .await?;
    Ok(results.into_iter().next().unwrap().into())
}

#[tauri::command]
#[specta::specta]
pub async fn maia_eval_batch(
    id: String,
    model_path: PathBuf,
    tab: String,
    positions: Vec<MaiaEvalPosition>,
    elo: f32,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<EvaluationResult>, Error> {
    if positions.is_empty() {
        return Ok(Vec::new());
    }

    let mut maia = state
        .maia_sessions
        .entry((tab, id))
        .or_try_insert_with(|| Maia::from_file(model_path))?;
    let setups: Vec<_> = positions
        .into_iter()
        .map(|position| {
            parse_fen_and_apply_moves(&position.fen, &position.moves)
                .map(|pos| pos.to_setup(EnPassantMode::Always))
        })
        .collect::<Result<_, _>>()?;
    let elos = vec![elo; setups.len()];
    let opts = ort::session::RunOptions::new().unwrap();
    let results = maia.batch_evaluate_async(setups, &elos, &elos, &opts).await?;
    Ok(results.into_iter().map(Into::into).collect())
}

#[tauri::command]
#[specta::specta]
pub async fn maia_best_moves(
    id: String,
    model_path: PathBuf,
    tab: String,
    fen: String,
    moves: Vec<String>,
    elo: f32,
    multipv: u16,
    state: tauri::State<'_, AppState>,
) -> Result<(f32, Vec<BestMoves>), Error> {
    let mut maia = state
        .maia_sessions
        .entry((tab, id))
        .or_try_insert_with(|| Maia::from_file(model_path))?;
    let pos = parse_fen_and_apply_moves(&fen, &moves)?;
    let setup = pos.clone().to_setup(EnPassantMode::Always);
    let opts = ort::session::RunOptions::new().unwrap();
    let eval = maia
        .batch_evaluate_async([setup], &[elo], &[elo], &opts)
        .await?
        .into_iter()
        .next()
        .unwrap();

    let w = (eval.white_wr * 1000.0).round() as i32;
    let d = (eval.draw * 1000.0).round() as i32;
    let l = (eval.black_wr * 1000.0).round() as i32;
    let cp = wdl_to_cp(eval.white_wr, eval.draw);
    let score = Score {
        value: ScoreValue::Cp(cp),
        wdl: Some((w, d, l)),
        ..Default::default()
    };

    let requested_multipv = usize::from(multipv.max(1));
    let max_lines = requested_multipv.min(eval.policy.len());
    let mut best_moves = Vec::with_capacity(max_lines);
    for (i, move_probability) in eval.policy.into_iter().take(max_lines).enumerate() {
        let uci: UciMove = move_probability.uci.to_string().parse()?;
        let m = uci.to_move(&pos)?;
        let mut move_pos = pos.clone();
        let san = SanPlus::from_move_and_play_unchecked(&mut move_pos, m).to_string();
        best_moves.push(BestMoves {
            nodes: 0,
            depth: 0,
            score: score.clone(),
            uci_moves: vec![uci.to_string()],
            san_moves: vec![san],
            multipv: (i + 1) as u16,
            nps: 0,
            probability: Some(move_probability.probability),
        });
    }

    Ok((100.0, best_moves))
}
