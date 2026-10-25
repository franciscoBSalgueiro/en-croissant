//! One-shot position evaluation for training features (replay-training
//! guess scoring).

use std::path::PathBuf;

use shakmaty::{Color, Position};
use vampirc_uci::{parse_one, uci::ScoreValue, UciInfoAttribute, UciMessage};

use crate::{
    engine::{parse_fen_and_apply_moves, BaseEngine, GoMode},
    error::Error,
};

/// Centipawn magnitude mapped from mate scores: mate in n becomes
/// `MATE_CP - n`, being mated in n becomes `-MATE_CP - n`.
const MATE_CP: i32 = 100_000;

fn score_value_to_centipawns(value: &ScoreValue) -> i32 {
    match *value {
        ScoreValue::Cp(cp) => cp,
        ScoreValue::Mate(n) => {
            if n > 0 {
                MATE_CP - n
            } else {
                -MATE_CP - n
            }
        }
    }
}

/// Extracts the score (side-to-move POV centipawns) from an `info` message's
/// attributes, if it carries one.
fn info_score_centipawns(attrs: &[UciInfoAttribute]) -> Option<i32> {
    attrs.iter().find_map(|attr| match attr {
        UciInfoAttribute::Score(score) => Some(score_value_to_centipawns(&score.value)),
        _ => None,
    })
}

/// Converts a side-to-move POV score to WHITE-POV centipawns.
fn to_white_cp(stm_cp: i32, turn: Color) -> i32 {
    if turn == Color::White {
        stm_cp
    } else {
        -stm_cp
    }
}

/// One-shot engine evaluation of a position at fixed depth.
/// Returns WHITE-POV centipawns (mate ±100000). Used to score replay-training
/// guesses and to power insights.
#[tauri::command]
#[specta::specta]
pub async fn evaluate_position(
    fen: String,
    moves: Vec<String>,
    engine_path: String,
    depth: u32,
) -> Result<i32, Error> {
    // Side to move once `moves` have been applied (engines report scores from
    // the searching side's point of view).
    let turn = parse_fen_and_apply_moves(&fen, &moves)?.turn();

    let mut engine = BaseEngine::spawn(PathBuf::from(engine_path)).await?;
    engine.init_uci().await?;
    engine.set_position(&fen, &moves).await?;
    // Depth 0 would make engines return immediately without any info line.
    engine.go(&GoMode::Depth(depth.max(1))).await?;

    let mut last_score: Option<i32> = None;
    let mut got_bestmove = false;
    {
        let reader = engine.reader_mut().ok_or(Error::EngineDisconnected)?;
        while let Some(line) = reader.next_line().await? {
            match parse_one(&line) {
                UciMessage::Info(attrs) => {
                    if let Some(score) = info_score_centipawns(&attrs) {
                        last_score = Some(score);
                    }
                }
                UciMessage::BestMove { .. } => {
                    got_bestmove = true;
                    break;
                }
                _ => {}
            }
        }
    }

    // Best-effort shutdown; the child process is killed on drop as well.
    let _ = engine.quit().await;

    let stm_cp = match last_score {
        Some(score) => score,
        // The engine answered without ever reporting a score (e.g. immediate
        // game end); there is nothing to convert.
        None if got_bestmove => return Err(Error::NoMovesFound),
        None => return Err(Error::EngineDisconnected),
    };

    Ok(to_white_cp(stm_cp, turn))
}

/// `'a'`-style letter for a 0-indexed file.

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn score_value_to_centipawns_maps_cp_and_mate() {
        assert_eq!(score_value_to_centipawns(&ScoreValue::Cp(35)), 35);
        assert_eq!(score_value_to_centipawns(&ScoreValue::Cp(-35)), -35);
        assert_eq!(score_value_to_centipawns(&ScoreValue::Mate(3)), MATE_CP - 3);
        assert_eq!(
            score_value_to_centipawns(&ScoreValue::Mate(-3)),
            -MATE_CP + 3
        );
        // Already mated from the searching side's point of view.
        assert_eq!(score_value_to_centipawns(&ScoreValue::Mate(0)), -MATE_CP);
    }

    #[test]
    fn info_score_is_extracted_from_uci_info() {
        let UciMessage::Info(attrs) = parse_one("info depth 8 score cp -35 pv e2e4") else {
            panic!("expected info message");
        };
        assert_eq!(info_score_centipawns(&attrs), Some(-35));

        let UciMessage::Info(attrs) = parse_one("info depth 8 score mate 3") else {
            panic!("expected info message");
        };
        assert_eq!(info_score_centipawns(&attrs), Some(MATE_CP - 3));

        let UciMessage::Info(attrs) = parse_one("info depth 8 nodes 42") else {
            panic!("expected info message");
        };
        assert_eq!(info_score_centipawns(&attrs), None);
    }

    #[test]
    fn white_pov_score_inverts_for_black_to_move() {
        assert_eq!(to_white_cp(35, Color::White), 35);
        assert_eq!(to_white_cp(-35, Color::Black), 35);
        assert_eq!(to_white_cp(MATE_CP - 3, Color::Black), -(MATE_CP - 3));
    }

}
