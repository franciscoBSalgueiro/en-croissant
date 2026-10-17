//! Monte Carlo simulation: engine self-play from a position, aggregated
//! outcomes and common piece paths. Contract: docs/features-architecture.md.

use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};

use rand::{seq::SliceRandom, Rng};
use serde::{Deserialize, Serialize};
use shakmaty::{
    fen::Fen, san::SanPlus, uci::UciMove, CastlingMode, Chess, Color, EnPassantMode, Position,
};
use specta::Type;
use tauri_specta::Event;
use tokio::sync::watch;
use vampirc_uci::{
    parse_one,
    uci::{Score, ScoreValue},
    UciInfoAttribute, UciMessage,
};

use crate::{
    engine::{parse_fen_and_apply_moves, BaseEngine, EngineOption, EngineReader, GoMode},
    error::Error,
    progress::update_progress,
    AppState,
};

#[derive(Deserialize, Type, Clone)]
pub struct SimulationConfig {
    pub fen: String,
    pub moves: Vec<String>,
    pub engine_path: String,
    pub engine_options: Vec<EngineOption>,
    pub movetime_ms: u32,
    pub games: u32,
    pub max_plies: u32,
    pub multipv: u8,
    pub temperature: f64,
}

#[derive(Serialize, Type, Clone)]
pub struct SimulationFirstMove {
    pub uci: String,
    pub san: String,
    pub total: u32,
    pub white: u32,
    pub draw: u32,
    pub black: u32,
    pub avg_length: f64,
}

#[derive(Serialize, Type, Clone)]
pub struct PiecePath {
    pub from: String,
    pub to: String,
    pub count: u32,
}

#[derive(Serialize, Type, Clone)]
pub struct SimulationResult {
    pub games: u32,
    pub white: u32,
    pub draw: u32,
    pub black: u32,
    pub avg_length: f64,
    pub first_moves: Vec<SimulationFirstMove>,
    pub piece_paths: Vec<PiecePath>,
}

#[derive(Serialize, Clone, Type, tauri_specta::Event)]
pub struct SimulationUpdateEvent {
    pub id: String,
    pub games_done: u32,
    pub white: u32,
    pub draw: u32,
    pub black: u32,
}

/// Handle for a running simulation; `shutdown` cancels the task between
/// plies and `cancel` is polled inside the ply loop.
pub struct SimulationHandle {
    pub shutdown: tokio::sync::watch::Sender<bool>,
    pub cancel: std::sync::Arc<std::sync::atomic::AtomicBool>,
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/// Centipawn magnitude assigned to mate scores (before clamping).
const MATE_CP: i32 = 100_000;
/// `|cp|` at or beyond which a ply-capped game is adjudicated for the
/// side that is ahead.
const ADJUDICATION_CP: i32 = 700;
/// Centipawn clamp applied to scores used as sampling weights.
const WEIGHT_CP_CLAMP: i32 = 1000;
/// Exponent clamp so the softmax weights never overflow `f64`.
const WEIGHT_EXP_CLAMP: f64 = 700.0;
/// Number of piece transitions kept in the final result.
const MAX_PIECE_PATHS: usize = 40;
/// Halfmove clock (in plies) that ends the game by the 50-move rule.
const FIFTY_MOVE_PLIES: u32 = 100;
/// Occurrences of a position that end the game by threefold repetition.
const REPETITION_LIMIT: u32 = 3;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Outcome {
    White,
    Draw,
    Black,
}

/// One MultiPV line of the current position: its first move and the
/// engine score converted to WHITE point of view.
#[derive(Clone)]
struct PvLine {
    uci: String,
    cp_white: i32,
}

struct GameOutcome {
    outcome: Outcome,
    plies: u32,
    /// `(uci, san)` of the first simulated move of the game.
    first_move: Option<(String, String)>,
    /// `(from, to)` square transitions of every simulated move.
    transitions: Vec<(String, String)>,
}

#[derive(Default)]
struct FirstMoveStats {
    san: String,
    total: u32,
    white: u32,
    draw: u32,
    black: u32,
    plies_sum: u64,
}

/// Cancellation state shared with `cancel_simulation`: the atomic flag is
/// polled between plies and between engine output lines, the shutdown
/// channel is checked between plies and between games.
struct CancelToken<'a> {
    cancel: &'a AtomicBool,
    shutdown: &'a watch::Receiver<bool>,
}

impl CancelToken<'_> {
    fn cancelled(&self) -> bool {
        self.cancel.load(Ordering::SeqCst) || *self.shutdown.borrow()
    }
}

#[tauri::command]
#[specta::specta]
pub async fn run_simulation(
    id: String,
    config: SimulationConfig,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<SimulationResult, Error> {
    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    let cancel = Arc::new(AtomicBool::new(false));
    let handle = Arc::new(SimulationHandle {
        shutdown: shutdown_tx,
        cancel: cancel.clone(),
    });
    state.simulations.insert(id.clone(), handle.clone());

    let result = simulate(&config, &app, state.inner(), &id, &shutdown_rx, &cancel).await;

    // Remove only our own handle: a restarted simulation may have
    // replaced the entry while we were running.
    state
        .simulations
        .remove_if(&id, |_, h| Arc::ptr_eq(h, &handle));
    result
}

#[tauri::command]
#[specta::specta]
pub async fn cancel_simulation(id: String, state: tauri::State<'_, AppState>) -> Result<(), Error> {
    if let Some(handle) = state.simulations.get(&id) {
        handle.cancel.store(true, Ordering::SeqCst);
        let _ = handle.shutdown.send(true);
    }
    Ok(())
}

async fn simulate(
    config: &SimulationConfig,
    app: &tauri::AppHandle,
    state: &AppState,
    id: &str,
    shutdown_rx: &watch::Receiver<bool>,
    cancel: &AtomicBool,
) -> Result<SimulationResult, Error> {
    let fen: Fen = config.fen.parse()?;
    let castling_mode = CastlingMode::detect(fen.as_setup());

    // One persistent engine process plays every game of the simulation.
    let mut engine = BaseEngine::spawn(PathBuf::from(&config.engine_path)).await?;
    engine.init_uci().await?;
    for option in &config.engine_options {
        // MultiPV and UCI_Chess960 are configured explicitly below.
        if option.name == "MultiPV" || option.name == "UCI_Chess960" {
            continue;
        }
        engine.set_option(&option.name, &option.value).await?;
    }
    engine.set_option("MultiPV", config.multipv.max(1)).await?;
    if castling_mode.is_chess960() {
        engine.set_option("UCI_Chess960", "true").await?;
    } else {
        engine.set_option("UCI_Chess960", "false").await?;
    }

    let mut reader = engine.take_reader().ok_or(Error::EngineDisconnected)?;

    let token = CancelToken {
        cancel,
        shutdown: shutdown_rx,
    };
    let result = run_games(
        config,
        app,
        state,
        id,
        &token,
        &mut engine,
        &mut reader,
        castling_mode,
    )
    .await;

    // Quit the engine on every exit path (Drop would also kill it).
    let _ = engine.quit().await;
    result
}

#[allow(clippy::too_many_arguments)]
async fn run_games(
    config: &SimulationConfig,
    app: &tauri::AppHandle,
    state: &AppState,
    id: &str,
    token: &CancelToken<'_>,
    engine: &mut BaseEngine,
    reader: &mut EngineReader,
    castling_mode: CastlingMode,
) -> Result<SimulationResult, Error> {
    let games = config.games;
    let mut white_wins = 0u32;
    let mut draws = 0u32;
    let mut black_wins = 0u32;
    let mut total_plies = 0u64;
    let mut first_move_stats: HashMap<String, FirstMoveStats> = HashMap::new();
    let mut path_counts: HashMap<(String, String), u32> = HashMap::new();

    for g in 0..games {
        if token.cancelled() {
            return Err(Error::AnalysisCancelled);
        }

        let game = simulate_game(config, engine, reader, token, castling_mode).await?;

        total_plies += game.plies as u64;
        for (from, to) in game.transitions {
            *path_counts.entry((from, to)).or_insert(0) += 1;
        }
        match game.outcome {
            Outcome::White => white_wins += 1,
            Outcome::Draw => draws += 1,
            Outcome::Black => black_wins += 1,
        }
        if let Some((uci, san)) = &game.first_move {
            let stats = first_move_stats.entry(uci.clone()).or_default();
            stats.san = san.clone();
            stats.total += 1;
            match game.outcome {
                Outcome::White => stats.white += 1,
                Outcome::Draw => stats.draw += 1,
                Outcome::Black => stats.black += 1,
            }
            stats.plies_sum += game.plies as u64;
        }

        SimulationUpdateEvent {
            id: id.to_string(),
            games_done: g + 1,
            white: white_wins,
            draw: draws,
            black: black_wins,
        }
        .emit(app)?;
        update_progress(
            &state.progress_state,
            app,
            id.to_string(),
            ((g + 1) as f32 / games as f32) * 100.0,
            false,
        )?;
    }

    update_progress(&state.progress_state, app, id.to_string(), 100.0, true)?;

    let mut first_moves: Vec<SimulationFirstMove> = first_move_stats
        .into_iter()
        .map(|(uci, s)| SimulationFirstMove {
            uci,
            san: s.san,
            total: s.total,
            white: s.white,
            draw: s.draw,
            black: s.black,
            avg_length: if s.total > 0 {
                s.plies_sum as f64 / s.total as f64
            } else {
                0.0
            },
        })
        .collect();
    first_moves.sort_by(|a, b| b.total.cmp(&a.total).then_with(|| a.uci.cmp(&b.uci)));

    let mut piece_paths: Vec<PiecePath> = path_counts
        .into_iter()
        .map(|((from, to), count)| PiecePath { from, to, count })
        .collect();
    piece_paths.sort_by(|a, b| {
        b.count
            .cmp(&a.count)
            .then_with(|| a.from.cmp(&b.from))
            .then_with(|| a.to.cmp(&b.to))
    });
    piece_paths.truncate(MAX_PIECE_PATHS);

    Ok(SimulationResult {
        games,
        white: white_wins,
        draw: draws,
        black: black_wins,
        avg_length: if games > 0 {
            total_plies as f64 / games as f64
        } else {
            0.0
        },
        first_moves,
        piece_paths,
    })
}

async fn simulate_game(
    config: &SimulationConfig,
    engine: &mut BaseEngine,
    reader: &mut EngineReader,
    token: &CancelToken<'_>,
    castling_mode: CastlingMode,
) -> Result<GameOutcome, Error> {
    let mut pos = parse_fen_and_apply_moves(&config.fen, &config.moves)?;
    let mut moves_so_far = config.moves.clone();
    let mut repetitions: HashMap<String, u32> = HashMap::new();
    repetitions.insert(position_key(&pos), 1);

    let mut transitions: Vec<(String, String)> = Vec::new();
    let mut first_move: Option<(String, String)> = None;
    let mut last_cp_white: Option<i32> = None;
    let mut plies: u32 = 0;
    let mut outcome = natural_end(&pos, &repetitions);

    while outcome.is_none() && plies < config.max_plies {
        if token.cancelled() {
            return Err(Error::AnalysisCancelled);
        }

        let lines = analyze_position(config, engine, reader, &moves_so_far, &pos, token).await?;
        last_cp_white = lines.first().map(|line| line.cp_white);

        let uci = choose_move(&lines, &pos, config.temperature, castling_mode);
        let parsed = UciMove::from_ascii(uci.as_bytes())?;
        let mv = parsed.to_move(&pos)?;
        let san = SanPlus::from_move_and_play_unchecked(&mut pos.clone(), &mv).to_string();

        if plies == 0 {
            first_move = Some((uci.clone(), san));
        }
        if uci.len() >= 4 {
            transitions.push((uci[0..2].to_string(), uci[2..4].to_string()));
        }

        pos.play_unchecked(&mv);
        moves_so_far.push(uci);
        *repetitions.entry(position_key(&pos)).or_insert(0) += 1;
        plies += 1;
        outcome = natural_end(&pos, &repetitions);
    }

    let outcome = outcome.unwrap_or_else(|| adjudicate(last_cp_white));
    Ok(GameOutcome {
        outcome,
        plies,
        first_move,
        transitions,
    })
}

/// Ask the engine for the current position and return its MultiPV lines
/// (first move + WHITE-POV centipawns each), best line first.
async fn analyze_position(
    config: &SimulationConfig,
    engine: &mut BaseEngine,
    reader: &mut EngineReader,
    moves_so_far: &[String],
    pos: &Chess,
    token: &CancelToken<'_>,
) -> Result<Vec<PvLine>, Error> {
    engine.set_position(&config.fen, moves_so_far).await?;
    engine.go(&GoMode::Time(config.movetime_ms)).await?;

    let multipv = config.multipv.max(1) as usize;
    let white_to_move = pos.turn() == Color::White;
    let mut lines: Vec<Option<PvLine>> = vec![None; multipv];

    while let Some(line) = reader.next_line().await? {
        if token.cancelled() {
            return Err(Error::AnalysisCancelled);
        }
        match parse_one(&line) {
            UciMessage::Info(attrs) => {
                let mut index = 1usize;
                let mut score: Option<Score> = None;
                let mut first_pv: Option<String> = None;
                for attr in attrs {
                    match attr {
                        UciInfoAttribute::MultiPv(n) => index = n as usize,
                        UciInfoAttribute::Score(s) => score = Some(s),
                        UciInfoAttribute::Pv(moves) => {
                            if let Some(first) = moves.first() {
                                first_pv = Some(first.to_string());
                            }
                        }
                        _ => (),
                    }
                }
                let (Some(score), Some(uci)) = (score, first_pv) else {
                    continue;
                };
                if score.lower_bound == Some(true) || score.upper_bound == Some(true) {
                    continue;
                }
                if index >= 1 && index <= multipv {
                    lines[index - 1] = Some(PvLine {
                        uci,
                        cp_white: score_value_to_cp_white(score.value, white_to_move),
                    });
                }
            }
            UciMessage::BestMove { .. } => break,
            _ => {}
        }
    }

    Ok(lines.into_iter().flatten().collect())
}

/// Softmax-sample among the MultiPV first moves by score (side-to-move
/// point of view, temperature-scaled); falls back to a uniformly random
/// legal move when no engine line is playable.
fn choose_move(
    lines: &[PvLine],
    pos: &Chess,
    temperature: f64,
    castling_mode: CastlingMode,
) -> String {
    let white_to_move = pos.turn() == Color::White;
    let mut candidates: Vec<(String, f64)> = Vec::new();
    for line in lines {
        let parsed = match UciMove::from_ascii(line.uci.as_bytes()) {
            Ok(parsed) => parsed,
            Err(_) => continue,
        };
        if parsed.to_move(pos).is_err() {
            continue;
        }
        let cp_mover = if white_to_move {
            line.cp_white
        } else {
            -line.cp_white
        };
        candidates.push((line.uci.clone(), move_weight(cp_mover, temperature)));
    }

    if candidates.is_empty() {
        let mut rng = rand::thread_rng();
        let legal = pos.legal_moves();
        if let Some(mv) = legal.choose(&mut rng) {
            return UciMove::from_move(mv, castling_mode).to_string();
        }
        return String::new();
    }

    let weights: Vec<f64> = candidates.iter().map(|(_, w)| *w).collect();
    let mut rng = rand::thread_rng();
    let index = sample_weighted(&weights, &mut rng);
    candidates[index].0.clone()
}

/// Softmax weight of a move scored `cp_mover` (side-to-move POV,
/// centipawns) at the given temperature, with clamps that keep the
/// exponent finite.
fn move_weight(cp_mover: i32, temperature: f64) -> f64 {
    let clamped = cp_mover.clamp(-WEIGHT_CP_CLAMP, WEIGHT_CP_CLAMP) as f64;
    let temp = if temperature > 0.0 {
        temperature
    } else {
        f64::MIN_POSITIVE
    };
    (clamped / temp).clamp(-WEIGHT_EXP_CLAMP, WEIGHT_EXP_CLAMP).exp()
}

/// Pick an index proportionally to `weights`.
fn sample_weighted(weights: &[f64], rng: &mut impl Rng) -> usize {
    if weights.is_empty() {
        return 0;
    }
    let total: f64 = weights.iter().sum();
    if !total.is_finite() || total <= 0.0 {
        return rng.gen_range(0..weights.len());
    }
    let mut target = rng.gen_range(0.0..total);
    for (index, weight) in weights.iter().enumerate() {
        if target < *weight {
            return index;
        }
        target -= weight;
    }
    weights.len() - 1
}

/// Convert an engine score (side-to-move POV) to WHITE-POV centipawns;
/// mate scores map onto a large magnitude beyond the adjudication and
/// clamping thresholds.
fn score_value_to_cp_white(value: ScoreValue, white_to_move: bool) -> i32 {
    let cp_mover = match value {
        ScoreValue::Cp(cp) => cp,
        ScoreValue::Mate(mate) => {
            if mate > 0 {
                MATE_CP - mate
            } else {
                -MATE_CP - mate
            }
        }
    };
    if white_to_move {
        cp_mover
    } else {
        -cp_mover
    }
}

/// First four FEN fields (placement, turn, castling, ep), the repetition key.
fn position_key(pos: &Chess) -> String {
    let fen = Fen::from_position(pos.clone(), EnPassantMode::Legal).to_string();
    fen.split_whitespace().take(4).collect::<Vec<_>>().join(" ")
}

/// Natural game end (checkmate, stalemate, insufficient material, 50-move
/// rule, threefold repetition) of the current position.
fn natural_end(pos: &Chess, repetitions: &HashMap<String, u32>) -> Option<Outcome> {
    if pos.is_checkmate() {
        return Some(if pos.turn() == Color::White {
            Outcome::Black
        } else {
            Outcome::White
        });
    }
    if pos.is_stalemate() || pos.is_insufficient_material() || pos.halfmoves() >= FIFTY_MOVE_PLIES
    {
        return Some(Outcome::Draw);
    }
    if repetitions
        .get(&position_key(pos))
        .copied()
        .unwrap_or(0)
        >= REPETITION_LIMIT
    {
        return Some(Outcome::Draw);
    }
    None
}

/// Adjudicate a ply-capped game from the last engine evaluation: decisive
/// for the side ahead at `|cp| >= 700`, a draw otherwise.
fn adjudicate(last_cp_white: Option<i32>) -> Outcome {
    match last_cp_white {
        Some(cp) if cp >= ADJUDICATION_CP => Outcome::White,
        Some(cp) if cp <= -ADJUDICATION_CP => Outcome::Black,
        _ => Outcome::Draw,
    }
}

#[cfg(test)]
mod tests {
    use rand::rngs::StdRng;
    use rand::SeedableRng;
    use shakmaty::FromSetup;

    use super::*;

    fn pos(fen: &str) -> Chess {
        let fen: Fen = fen.parse().unwrap();
        Chess::from_setup(fen.into_setup(), CastlingMode::Chess960).unwrap()
    }

    #[test]
    fn weights_are_positive_and_finite() {
        assert_eq!(move_weight(0, 60.0), 1.0);
        assert!(move_weight(-1000, 60.0) > 0.0);
        // extreme scores and temperatures must not overflow
        assert!(move_weight(1_000_000, 60.0).is_finite());
        assert!(move_weight(-1_000_000, 0.001).is_finite());
    }

    #[test]
    fn best_move_dominates_at_low_temperature() {
        let best = move_weight(100, 0.01);
        let worse = move_weight(-100, 0.01);
        assert!(best / worse > 1e100);
    }

    #[test]
    fn weighted_sampling_follows_weights() {
        let mut rng = StdRng::seed_from_u64(42);
        let mut first = 0;
        for _ in 0..1000 {
            if sample_weighted(&[0.9, 0.1], &mut rng) == 0 {
                first += 1;
            }
        }
        assert!((800..=1000).contains(&first), "picked first {}", first);
    }

    #[test]
    fn weighted_sampling_handles_degenerate_weights() {
        let mut rng = StdRng::seed_from_u64(7);
        assert_eq!(sample_weighted(&[], &mut rng), 0);
        let index = sample_weighted(&[0.0, 0.0], &mut rng);
        assert!(index < 2);
    }

    #[test]
    fn cp_conversion_is_white_pov() {
        assert_eq!(score_value_to_cp_white(ScoreValue::Cp(50), true), 50);
        assert_eq!(score_value_to_cp_white(ScoreValue::Cp(50), false), -50);
    }

    #[test]
    fn mate_scores_exceed_adjudication_threshold() {
        assert!(score_value_to_cp_white(ScoreValue::Mate(1), true) > ADJUDICATION_CP);
        // black is getting mated: white POV is still a white win
        assert!(score_value_to_cp_white(ScoreValue::Mate(-3), false) > ADJUDICATION_CP);
        assert!(score_value_to_cp_white(ScoreValue::Mate(2), false) < -ADJUDICATION_CP);
    }

    #[test]
    fn start_position_has_no_natural_end() {
        let pos = Chess::default();
        let repetitions = HashMap::new();
        assert_eq!(natural_end(&pos, &repetitions), None);
    }

    #[test]
    fn fools_mate_is_a_black_win() {
        let pos = pos("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3");
        let repetitions = HashMap::new();
        assert_eq!(natural_end(&pos, &repetitions), Some(Outcome::Black));
    }

    #[test]
    fn threefold_repetition_ends_the_game() {
        let pos = Chess::default();
        let mut repetitions = HashMap::new();
        repetitions.insert(position_key(&pos), 3);
        assert_eq!(natural_end(&pos, &repetitions), Some(Outcome::Draw));
    }

    #[test]
    fn adjudication_uses_last_score() {
        assert_eq!(adjudicate(Some(800)), Outcome::White);
        assert_eq!(adjudicate(Some(-900)), Outcome::Black);
        assert_eq!(adjudicate(Some(100)), Outcome::Draw);
        assert_eq!(adjudicate(None), Outcome::Draw);
    }
}
