use shakmaty::{fen::Fen, uci::UciMove, CastlingMode, Chess, Color, Position};

use super::{count_material, naive_eval, qsearch};

const CHECKMATES: [(&str, Color); 2] = [
    ("8/8/8/8/8/6k1/6q1/7K w - - 0 1", Color::White),
    ("7k/6Q1/6K1/8/8/8/8/8 b - - 0 1", Color::Black),
];

const STALEMATES: [(&str, Color); 2] = [
    ("8/8/8/8/8/6k1/5q2/7K w - - 0 1", Color::White),
    ("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", Color::Black),
];

fn position(fen: &str) -> Chess {
    fen.parse::<Fen>()
        .unwrap()
        .into_position(CastlingMode::Standard)
        .unwrap()
}

#[test]
fn count_material_checkmate_is_a_loss_for_either_side_to_move() {
    for (fen, turn) in CHECKMATES {
        let pos = position(fen);
        assert_eq!(pos.turn(), turn);
        assert!(pos.is_checkmate());
        assert!(pos.legal_moves().is_empty());
        assert_eq!(count_material(&pos), -10000, "{fen}");
    }
}

#[test]
fn count_material_stalemate_is_draw_despite_extra_queen() {
    for (fen, turn) in STALEMATES {
        let pos = position(fen);
        assert_eq!(pos.turn(), turn);
        assert!(pos.is_stalemate());
        assert!(!pos.is_check());
        assert!(pos.legal_moves().is_empty());
        assert_eq!(pos.board().material().get(turn).queen, 0);
        assert_eq!(pos.board().material().get(!turn).queen, 1);
        assert_eq!(count_material(&pos), 0, "{fen}");
    }
}

#[test]
fn naive_eval_checkmate_is_a_loss_for_either_side_to_move() {
    for (fen, _) in CHECKMATES {
        assert_eq!(naive_eval(&position(fen)), -10000, "{fen}");
    }
}

#[test]
fn naive_eval_stalemate_is_draw_for_either_side_to_move() {
    for (fen, _) in STALEMATES {
        assert_eq!(naive_eval(&position(fen)), 0, "{fen}");
    }
}

#[test]
fn terminal_evaluations_are_safe_to_negate() {
    for (positions, expected_negated) in [(CHECKMATES, 10000), (STALEMATES, 0)] {
        for (fen, _) in positions {
            let pos = position(fen);
            for score in [count_material(&pos), naive_eval(&pos)] {
                assert_ne!(score, i32::MIN, "{fen}");
                assert_eq!(score.checked_neg(), Some(expected_negated), "{fen}");
            }
        }
    }
}

#[test]
fn qsearch_full_window_uses_terminal_material_score() {
    for (positions, expected) in [(CHECKMATES, -10000), (STALEMATES, 0)] {
        for (fen, _) in positions {
            assert_eq!(
                qsearch(&position(fen), i32::MIN, i32::MAX),
                expected,
                "{fen}"
            );
        }
    }
}

#[test]
fn naive_eval_can_choose_stalemate_instead_of_a_material_loss() {
    // Kf8 leaves White's king trapped behind its own blocked rook pawn.
    let pos = position("7K/5k1P/8/8/8/8/8/8 b - - 0 1");
    assert!(!pos.is_game_over());
    assert!(count_material(&pos) < 0);
    let stalemating_move = "f7f8".parse::<UciMove>().unwrap().to_move(&pos).unwrap();
    let mut child = pos.clone();
    child.play_unchecked(&stalemating_move);
    assert!(child.is_stalemate());
    assert_eq!(naive_eval(&pos), 0);
}
