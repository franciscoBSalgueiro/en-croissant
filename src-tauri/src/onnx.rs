use std::path::PathBuf;

use maia_rust::{EvaluationResult, Maia};
use shakmaty::{EnPassantMode, Position};

use crate::{engine::parse_fen_and_apply_moves, error::Error, AppState};

#[tauri::command]
#[specta::specta]
pub async fn maia_eval(
    id: String,
    model_path: PathBuf,
    tab: String,
    fen: String,
    moves: Vec<String>,
    elo: u32,
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
    Ok(results.into_iter().next().unwrap())
}
