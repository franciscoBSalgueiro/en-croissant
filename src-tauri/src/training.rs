//! Training helpers: one-shot position evaluation, pawn-structure motifs and
//! position insights. Contract: docs/learning-features-architecture.md.

use std::path::PathBuf;

use serde::Serialize;
use shakmaty::{Bitboard, Board, Chess, Color, Position, Role, Square};
use specta::Type;
use vampirc_uci::{parse_one, uci::ScoreValue, UciInfoAttribute, UciMessage};

use crate::{
    engine::{parse_fen_and_apply_moves, parse_fen_to_position, BaseEngine, GoMode},
    error::Error,
};

#[derive(Debug, Serialize, Clone, Type)]
pub struct StructureFeatures {
    pub white_doubled: u8,
    pub black_doubled: u8,
    pub white_isolated: u8,
    pub black_isolated: u8,
    pub white_passed: u8,
    pub black_passed: u8,
    pub white_islands: u8,
    pub black_islands: u8,
    pub open_files: Vec<String>,
    pub semi_open_white: Vec<String>,
    pub semi_open_black: Vec<String>,
}

#[derive(Debug, Serialize, Clone, Type)]
pub struct StructureReport {
    pub fen: String,
    pub motifs: Vec<String>,
    pub features: StructureFeatures,
}

#[derive(Debug, Serialize, Clone, Type)]
pub struct PositionInsights {
    pub material_diff: i32,
    pub white_castled: bool,
    pub black_castled: bool,
    pub white_minor_developed: u8,
    pub black_minor_developed: u8,
    pub hanging_white: Vec<String>,
    pub hanging_black: Vec<String>,
    pub structure: StructureReport,
}

/// Centipawn magnitude mapped from mate scores: mate in n becomes
/// `MATE_CP - n`, being mated in n becomes `-MATE_CP - n`.
const MATE_CP: i32 = 100_000;

// File indexes (a = 0 .. h = 7) used by the motif rules.
const FILE_C: i32 = 2;
const FILE_D: i32 = 3;
const FILE_E: i32 = 4;
const FILE_F: i32 = 5;

/// Converts an engine score value (side-to-move POV) to centipawns from that
/// side's point of view, mapping mate scores to just under ±`MATE_CP`.
/// "mate 0" means the side to move is already getting mated.
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
fn file_letter(file: i32) -> String {
    char::from(b'a' + file as u8).to_string()
}

/// Per-color pawn placement data used by the feature counters and motif
/// rules. Files and ranks are 0-indexed (a1 = (0, 0)).
struct Pawns {
    squares: Vec<(i32, i32)>,
    counts: [u8; 8],
}

impl Pawns {
    fn new(pawns: Bitboard) -> Self {
        let mut squares = Vec::with_capacity(8);
        let mut counts = [0u8; 8];
        for sq in pawns {
            let file = i32::from(sq.file());
            squares.push((file, i32::from(sq.rank())));
            counts[file as usize] += 1;
        }
        Self { squares, counts }
    }

    /// Pawns on `file`; out-of-board indexes count as empty.
    fn count_at(&self, file: i32) -> u8 {
        if (0..8).contains(&file) {
            self.counts[file as usize]
        } else {
            0
        }
    }

    fn owns(&self, file: i32) -> bool {
        self.count_at(file) > 0
    }

    /// Doubled pawn instances: for every file, the pawns beyond the first.
    fn doubled(&self) -> u8 {
        self.counts.iter().map(|&c| c.saturating_sub(1)).sum()
    }

    /// Pawns with no friendly pawn on either adjacent file.
    fn isolated(&self) -> Vec<(i32, i32)> {
        self.squares
            .iter()
            .copied()
            .filter(|&(file, _)| !self.owns(file - 1) && !self.owns(file + 1))
            .collect()
    }

    /// Pawns with no enemy pawn ahead of them on their own or an adjacent
    /// file ("ahead" relative to `color`'s pushing direction).
    fn passed_against(&self, enemy: &Pawns, color: Color) -> u8 {
        self.squares
            .iter()
            .filter(|&&(file, rank)| {
                !enemy.squares.iter().any(|&(enemy_file, enemy_rank)| {
                    (enemy_file - file).abs() <= 1
                        && if color == Color::White {
                            enemy_rank > rank
                        } else {
                            enemy_rank < rank
                        }
                })
            })
            .count() as u8
    }

    /// Number of maximal runs of consecutive files containing a pawn.
    fn islands(&self) -> u8 {
        let mut islands = 0;
        let mut previous_occupied = false;
        for file in 0..8 {
            let occupied = self.counts[file as usize] > 0;
            if occupied && !previous_occupied {
                islands += 1;
            }
            previous_occupied = occupied;
        }
        islands
    }

    /// Pawns that have friendly pawns on adjacent files, all of which are
    /// ahead of them (from `color`'s perspective): they sit behind their own
    /// chain and can never be defended by another pawn.
    fn backward(&self, color: Color) -> u8 {
        self.squares
            .iter()
            .filter(|&&(file, rank)| self.is_backward(file, rank, color))
            .count() as u8
    }

    fn is_backward(&self, file: i32, rank: i32, color: Color) -> bool {
        let mut has_neighbor = false;
        let mut supportable = false;
        for neighbor_file in [file - 1, file + 1] {
            for &(f, r) in &self.squares {
                if f == neighbor_file {
                    has_neighbor = true;
                    let ahead = if color == Color::White { r > rank } else { r < rank };
                    if !ahead {
                        supportable = true;
                    }
                }
            }
        }
        has_neighbor && !supportable
    }

    /// Whether any pawn on `file` is deep enough for the hanging-pair rule.
    fn has_advanced(&self, file: i32, color: Color) -> bool {
        self.squares
            .iter()
            .any(|&(f, r)| f == file && advanced_enough(r, color))
    }
}

/// Whether a pawn rank is deep enough for the hanging-pair rule: 4th rank or
/// beyond for White, 5th rank or before for Black (0-indexed ranks).
fn advanced_enough(rank: i32, color: Color) -> bool {
    if color == Color::White {
        rank >= 3
    } else {
        rank <= 4
    }
}

fn build_features(white: &Pawns, black: &Pawns) -> StructureFeatures {
    let mut open_files = Vec::new();
    let mut semi_open_white = Vec::new();
    let mut semi_open_black = Vec::new();

    for file in 0..8 {
        let letter = file_letter(file);
        let w = white.count_at(file);
        let b = black.count_at(file);
        if w == 0 && b == 0 {
            open_files.push(letter);
        } else if w == 0 {
            // No white pawn but at least one black pawn.
            semi_open_white.push(letter);
        } else if b == 0 {
            semi_open_black.push(letter);
        }
    }

    StructureFeatures {
        white_doubled: white.doubled(),
        black_doubled: black.doubled(),
        white_isolated: white.isolated().len() as u8,
        black_isolated: black.isolated().len() as u8,
        white_passed: white.passed_against(black, Color::White),
        black_passed: black.passed_against(white, Color::Black),
        white_islands: white.islands(),
        black_islands: black.islands(),
        open_files,
        semi_open_white,
        semi_open_black,
    }
}

/// Best-effort named motifs for a pawn structure. Every rule is deterministic
/// and documented where it is computed; several motifs may apply at once.
fn detect_motifs(white: &Pawns, black: &Pawns, features: &StructureFeatures) -> Vec<String> {
    let white_isolated = white.isolated();
    let black_isolated = black.isolated();

    // "Isolated Queen's Pawn": a color has exactly one isolated pawn, it sits
    // on the d-file, and there are no friendly pawns on the c- or e-files.
    let iqp = [(white, &white_isolated), (black, &black_isolated)]
        .into_iter()
        .any(|(pawns, isolated)| {
            isolated.len() == 1
                && isolated[0].0 == FILE_D
                && !pawns.owns(FILE_C)
                && !pawns.owns(FILE_E)
        });

    // "Hanging Pawns": exactly two pawns side by side on adjacent files (one
    // per file), both advanced past the middle of the board for their color,
    // with no friendly pawns on the files next to the pair.
    let hanging = [(white, Color::White), (black, Color::Black)]
        .into_iter()
        .any(|(pawns, color)| {
            (0..7).any(|file| {
                pawns.count_at(file) == 1
                    && pawns.count_at(file + 1) == 1
                    && !pawns.owns(file - 1)
                    && !pawns.owns(file + 2)
                    && pawns.has_advanced(file, color)
                    && pawns.has_advanced(file + 1, color)
            })
        });

    // "Carlsbad Structure" (simplified signature of the QGD-exchange
    // skeleton, checked for both orientations): one side has pawns on the d-
    // and e-files but none on c, the other has pawns on c and d but none on
    // e, giving each side an asymmetric majority.
    let carlsbad = (white.owns(FILE_D)
        && white.owns(FILE_E)
        && !white.owns(FILE_C)
        && black.owns(FILE_C)
        && black.owns(FILE_D)
        && !black.owns(FILE_E))
        || (black.owns(FILE_D)
            && black.owns(FILE_E)
            && !black.owns(FILE_C)
            && white.owns(FILE_C)
            && white.owns(FILE_D)
            && !white.owns(FILE_E));

    // "Open Center": no pawns of either color on the d- and e-files.
    let open_center =
        !white.owns(FILE_D) && !black.owns(FILE_D) && !white.owns(FILE_E) && !black.owns(FILE_E);

    // "Closed Center": every central file (c to f) has pawns of both colors.
    let closed_center = (FILE_C..=FILE_F).all(|file| white.owns(file) && black.owns(file));

    // "Symmetrical Structure": both colors have pawns on the same files.
    let symmetrical = (0..8).all(|file| white.owns(file) == black.owns(file));

    // "Pawn Chain": four or more consecutive files with pawns of one color.
    let pawn_chain = [white, black].into_iter().any(|pawns| {
        (0..=4).any(|start| (start..start + 4).all(|file| pawns.owns(file)))
    });

    // "Backward Pawn": see `Pawns::backward` for the rule.
    let backward = white.backward(Color::White) + black.backward(Color::Black) > 0;

    let passed = features.white_passed + features.black_passed > 0;

    let mut motifs = Vec::new();
    if iqp {
        motifs.push("Isolated Queen's Pawn".to_string());
    }
    if hanging {
        motifs.push("Hanging Pawns".to_string());
    }
    if carlsbad {
        motifs.push("Carlsbad Structure".to_string());
    }
    if open_center {
        motifs.push("Open Center".to_string());
    }
    if closed_center {
        motifs.push("Closed Center".to_string());
    }
    if symmetrical {
        motifs.push("Symmetrical Structure".to_string());
    }
    if pawn_chain {
        motifs.push("Pawn Chain".to_string());
    }
    if backward {
        motifs.push("Backward Pawn".to_string());
    }
    if passed {
        motifs.push("Passed Pawn(s)".to_string());
    }
    motifs
}

fn analyze_structure(position: &Chess) -> (StructureFeatures, Vec<String>) {
    let board = position.board();
    let white = Pawns::new(board.pawns() & board.by_color(Color::White));
    let black = Pawns::new(board.pawns() & board.by_color(Color::Black));
    let features = build_features(&white, &black);
    let motifs = detect_motifs(&white, &black, &features);
    (features, motifs)
}

/// Named pawn-structure motifs plus raw structure features for a position.
#[tauri::command]
#[specta::specta]
pub async fn structure_report(fen: String) -> Result<StructureReport, Error> {
    let position = parse_fen_to_position(&fen)?;
    let (features, motifs) = analyze_structure(&position);
    Ok(StructureReport { fen, motifs, features })
}

/// Material value of `color`'s pieces with the standard simple weights
/// (pawn = 1, knight = 3, bishop = 3, rook = 5, queen = 9).
fn material_value(board: &Board, color: Color) -> i32 {
    let material = board.material_side(color);
    material.pawn as i32
        + material.knight as i32 * 3
        + material.bishop as i32 * 3
        + material.rook as i32 * 5
        + material.queen as i32 * 9
}

// Minor-piece home squares (knights and bishops on their starting squares).
const WHITE_MINOR_HOME: [Square; 4] = [Square::B1, Square::G1, Square::C1, Square::F1];
const BLACK_MINOR_HOME: [Square; 4] = [Square::B8, Square::G8, Square::C8, Square::F8];

/// Knights and bishops of `color` that left their home squares.
fn developed_minors(board: &Board, color: Color) -> u8 {
    let home: &[Square; 4] = if color == Color::White {
        &WHITE_MINOR_HOME
    } else {
        &BLACK_MINOR_HOME
    };
    let minors = (board.knights() | board.bishops()) & board.by_color(color);
    minors
        .into_iter()
        .filter(|sq| !home.contains(sq))
        .count() as u8
}

/// Squares of `color`'s pieces (kings excluded) that are attacked by the
/// enemy and not defended by any friendly piece. Pins are ignored: a pinned
/// piece still counts as attacker and defender.
fn hanging_pieces(board: &Board, color: Color) -> Vec<String> {
    let mut hanging = Vec::new();
    let occupied = board.occupied();
    for sq in board.by_color(color) {
        if board.piece_at(sq).map(|piece| piece.role) == Some(Role::King) {
            continue;
        }
        let attacked = !board.attacks_to(sq, color.other(), occupied).is_empty();
        let defended = !board.attacks_to(sq, color, occupied).is_empty();
        if attacked && !defended {
            hanging.push(sq.to_string());
        }
    }
    hanging
}

fn compute_insights(position: &Chess, fen: &str) -> PositionInsights {
    let board = position.board();
    let (features, motifs) = analyze_structure(position);

    PositionInsights {
        material_diff: material_value(board, Color::White) - material_value(board, Color::Black),
        // King-off-original-square castling heuristic.
        white_castled: board.king_of(Color::White).is_some_and(|sq| sq != Square::E1),
        black_castled: board.king_of(Color::Black).is_some_and(|sq| sq != Square::E8),
        white_minor_developed: developed_minors(board, Color::White),
        black_minor_developed: developed_minors(board, Color::Black),
        hanging_white: hanging_pieces(board, Color::White),
        hanging_black: hanging_pieces(board, Color::Black),
        structure: StructureReport {
            fen: fen.to_string(),
            motifs,
            features,
        },
    }
}

/// Natural-language-friendly position summary atoms: material balance,
/// castling/development heuristics, hanging pieces and the structure report.
#[tauri::command]
#[specta::specta]
pub async fn position_insights(fen: String) -> Result<PositionInsights, Error> {
    let position = parse_fen_to_position(&fen)?;
    Ok(compute_insights(&position, &fen))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn position(fen: &str) -> Chess {
        parse_fen_to_position(fen).unwrap()
    }

    fn structure(fen: &str) -> StructureReport {
        let (features, motifs) = analyze_structure(&position(fen));
        StructureReport {
            fen: fen.to_string(),
            motifs,
            features,
        }
    }

    fn insights(fen: &str) -> PositionInsights {
        compute_insights(&position(fen), fen)
    }

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

    #[test]
    fn startpos_structure_is_closed_and_symmetrical() {
        let report = structure("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
        let f = report.features;
        assert_eq!(f.white_doubled, 0);
        assert_eq!(f.black_doubled, 0);
        assert_eq!(f.white_isolated, 0);
        assert_eq!(f.black_isolated, 0);
        assert_eq!(f.white_passed, 0);
        assert_eq!(f.black_passed, 0);
        assert_eq!(f.white_islands, 1);
        assert_eq!(f.black_islands, 1);
        assert!(f.open_files.is_empty());
        assert!(f.semi_open_white.is_empty());
        assert!(f.semi_open_black.is_empty());
        assert_eq!(
            report.motifs,
            vec!["Closed Center", "Symmetrical Structure", "Pawn Chain"]
        );
    }

    #[test]
    fn isolated_queens_pawn_is_detected() {
        // White pawns a2/b2/d4/f2/g2/h2, black pawns c6/d5: d4 is the lone
        // isolated pawn on the d-file.
        let report = structure("4k3/8/2p5/3p4/3P4/8/PP3PPP/4K3 w - - 0 1");
        let f = report.features;
        assert_eq!(f.white_isolated, 1);
        assert_eq!(f.black_isolated, 0);
        assert_eq!(f.white_passed, 4); // a2, f2, g2, h2
        assert_eq!(f.black_passed, 0);
        assert_eq!(f.white_islands, 3);
        assert_eq!(f.black_islands, 1);
        assert_eq!(f.open_files, vec!["e"]);
        assert_eq!(f.semi_open_white, vec!["c"]);
        assert_eq!(f.semi_open_black, vec!["a", "b", "f", "g", "h"]);
        assert!(report.motifs.contains(&"Isolated Queen's Pawn".to_string()));
        assert!(report.motifs.contains(&"Passed Pawn(s)".to_string()));
    }

    #[test]
    fn hanging_pawns_are_detected() {
        // White pawns a2/c4/d4/f2/g2/h2: the c4+d4 pair is alone on its
        // files, past the middle of the board.
        let report = structure("4k3/pp3ppp/4p3/8/2PP4/8/P4PPP/4K3 w - - 0 1");
        let f = report.features;
        assert_eq!(f.white_isolated, 1); // a2
        assert_eq!(f.white_passed, 0);
        assert_eq!(f.black_passed, 0);
        assert_eq!(f.white_islands, 3);
        assert_eq!(f.black_islands, 2);
        assert!(f.open_files.is_empty());
        assert_eq!(f.semi_open_white, vec!["b", "e"]);
        assert_eq!(f.semi_open_black, vec!["c", "d"]);
        assert_eq!(report.motifs, vec!["Hanging Pawns", "Pawn Chain"]);
    }

    #[test]
    fn carlsbad_structure_is_detected() {
        // White pawns a2/b2/d4/e3/f2/g2/h2, black a7/b7/c7/d5/f7/g7/h7: the
        // QGD-exchange skeleton (d+e vs c+d, missing c resp. e pawn).
        let report = structure("4k3/ppp2ppp/8/3p4/3P4/4P3/PP3PPP/4K3 w - - 0 1");
        let f = report.features;
        assert_eq!(f.white_doubled, 0);
        assert_eq!(f.white_isolated, 0);
        assert_eq!(f.black_isolated, 0);
        assert_eq!(f.white_passed, 0);
        assert_eq!(f.black_passed, 0);
        assert_eq!(f.white_islands, 2);
        assert_eq!(f.black_islands, 2);
        assert_eq!(f.open_files, Vec::<String>::new());
        assert_eq!(f.semi_open_white, vec!["c"]);
        assert_eq!(f.semi_open_black, vec!["e"]);
        assert_eq!(report.motifs, vec!["Carlsbad Structure", "Pawn Chain"]);
    }

    #[test]
    fn backward_pawn_is_detected() {
        // White pawns a2/c5/d3/e5/h2: d3 sits behind both c5 and e5, which
        // can never come back to defend it.
        let report = structure("4k3/p6p/2p1p3/2P1P3/8/3P4/P6P/4K3 w - - 0 1");
        let f = report.features;
        assert_eq!(f.white_isolated, 2); // a2, h2
        assert_eq!(f.black_isolated, 4); // a7, c6, e6, h7
        assert_eq!(f.white_passed, 0);
        assert_eq!(f.black_passed, 0);
        assert_eq!(f.white_islands, 3);
        assert_eq!(f.black_islands, 4);
        assert_eq!(f.open_files, vec!["b", "f", "g"]);
        assert!(f.semi_open_white.is_empty());
        assert_eq!(f.semi_open_black, vec!["d"]);
        assert_eq!(report.motifs, vec!["Backward Pawn"]);
    }

    #[test]
    fn doubled_pawns_and_passed_count() {
        // White pawns a2/b2/c3/c4/d4, no black pawns: c3+c4 are doubled and
        // every white pawn has passed the enemy (there is none).
        let report = structure("4k3/8/8/8/2PP4/2P5/PP6/4K3 w - - 0 1");
        let f = report.features;
        assert_eq!(f.white_doubled, 1);
        assert_eq!(f.black_doubled, 0);
        assert_eq!(f.white_passed, 5);
        assert_eq!(f.white_isolated, 0);
        assert_eq!(f.white_islands, 1);
        assert_eq!(f.open_files, vec!["e", "f", "g", "h"]);
        assert!(f.semi_open_white.is_empty());
        assert_eq!(f.semi_open_black, vec!["a", "b", "c", "d"]);
        assert_eq!(report.motifs, vec!["Pawn Chain", "Passed Pawn(s)"]);
    }

    #[test]
    fn open_center_is_detected() {
        let report = structure("4k3/8/8/8/8/8/P6P/4K3 w - - 0 1");
        let f = report.features;
        assert_eq!(f.white_isolated, 2); // a2, h2
        assert_eq!(f.white_passed, 2);
        assert_eq!(f.white_islands, 2);
        assert_eq!(f.open_files, vec!["b", "c", "d", "e", "f", "g"]);
        assert!(f.semi_open_white.is_empty());
        assert_eq!(f.semi_open_black, vec!["a", "h"]);
        assert_eq!(report.motifs, vec!["Open Center", "Passed Pawn(s)"]);
    }

    #[test]
    fn insights_for_startpos() {
        let ins = insights("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
        assert_eq!(ins.material_diff, 0);
        assert!(!ins.white_castled);
        assert!(!ins.black_castled);
        assert_eq!(ins.white_minor_developed, 0);
        assert_eq!(ins.black_minor_developed, 0);
        assert!(ins.hanging_white.is_empty());
        assert!(ins.hanging_black.is_empty());
        assert_eq!(ins.structure.motifs.len(), 3);
        assert_eq!(ins.structure.fen, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    }

    #[test]
    fn insights_count_material_development_and_castling() {
        // Italian game: Bb5 and Nf3 out for White, Nc6 for Black, no king
        // has castled yet.
        let ins = insights("r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3");
        assert_eq!(ins.material_diff, 0);
        assert!(!ins.white_castled);
        assert!(!ins.black_castled);
        assert_eq!(ins.white_minor_developed, 2); // Bb5, Nf3
        assert_eq!(ins.black_minor_developed, 1); // Nc6
        assert!(ins.hanging_white.is_empty());
        assert!(ins.hanging_black.is_empty());
    }

    #[test]
    fn insights_material_diff_is_white_minus_black() {
        let ins = insights("4k3/8/8/4q3/8/8/4P3/4K3 w - - 0 1");
        assert_eq!(ins.material_diff, 1 - 9);
    }

    #[test]
    fn insights_detects_castled_kings() {
        let ins = insights("r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 8 8");
        assert_eq!(ins.material_diff, 0);
        assert!(ins.white_castled);
        assert!(ins.black_castled);
        assert_eq!(ins.white_minor_developed, 3); // Nc3, Nf3, Bc4
        assert_eq!(ins.black_minor_developed, 3); // Nc6, Nf6, Bc5
        assert!(ins.hanging_white.is_empty());
        assert!(ins.hanging_black.is_empty());
    }

    #[test]
    fn insights_detects_mutually_hanging_queens() {
        let ins = insights("4k3/8/8/3q4/8/3Q4/8/4K3 w - - 0 1");
        assert_eq!(ins.material_diff, 0);
        assert_eq!(ins.hanging_white, vec!["d3"]);
        assert_eq!(ins.hanging_black, vec!["d5"]);
    }
}
