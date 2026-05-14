use std::{
    collections::HashMap,
    fs::File,
    io::{BufRead, BufReader, Cursor, Read, Write},
    ops::ControlFlow,
    path::PathBuf,
    sync::Arc,
    time::Instant,
};

use dashmap::DashMap;
use log::{error, info};
use pgn_reader::{RawTag, Reader, SanPlus, Skip, Visitor};
use polyglot_book_rs::PolyglotBook;
use rand::{seq::IteratorRandom, Rng};
use serde::{Deserialize, Serialize};
use shakmaty::{fen::Fen, uci::UciMove, CastlingMode, Chess, Color, EnPassantMode, Position};
use specta::Type;
use tauri::AppHandle;
use tauri_specta::Event;
use tokio::{
    sync::{watch, Mutex, RwLock},
    time::{interval, Duration},
};

use crate::{
    engine::{parse_fen_to_position, BaseEngine, EngineLog, EngineOption, GoMode, PlayersTime},
    error::Error,
};

pub type GameId = String;

#[derive(Clone, Debug, Serialize, Deserialize, Type)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum PlayerConfig {
    Human {
        name: String,
    },
    Engine {
        name: String,
        path: String,
        #[serde(default)]
        options: Vec<EngineOption>,
        go: Option<GoMode>,
    },
}

#[derive(Clone, Debug, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TimeControl {
    pub initial_time: u64,
    pub increment: u64,
}

#[derive(Clone, Debug, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GameConfig {
    pub white: PlayerConfig,
    pub black: PlayerConfig,
    pub white_time_control: Option<TimeControl>,
    pub black_time_control: Option<TimeControl>,
    pub initial_fen: Option<String>,
    #[serde(default)]
    pub initial_moves: Vec<String>,
    pub opening_book: Option<OpeningBookConfig>,
}

#[derive(Clone, Debug, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct OpeningBookConfig {
    pub path: String,
    #[serde(default = "default_opening_book_max_ply")]
    pub max_ply: usize,
}

fn default_opening_book_max_ply() -> usize {
    40
}

#[derive(Clone, Debug, Serialize, Type, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum GameStatus {
    Playing,
    Finished { result: GameResult },
}

#[derive(Clone, Debug, Serialize, Deserialize, Type, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum GameResult {
    WhiteWins { reason: GameEndReason },
    BlackWins { reason: GameEndReason },
    Draw { reason: DrawReason },
}

#[derive(Clone, Debug, Serialize, Deserialize, Type, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum GameEndReason {
    Checkmate,
    Timeout,
    Resignation,
    Abandonment,
}

#[derive(Clone, Debug, Serialize, Deserialize, Type, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum DrawReason {
    Stalemate,
    InsufficientMaterial,
    ThreefoldRepetition,
    FiftyMoveRule,
    Agreement,
}

#[derive(Clone, Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GameMove {
    pub uci: String,
    pub san: String,
    pub fen_after: String,
    pub clock: Option<u64>,
    pub white_time: Option<u64>,
    pub black_time: Option<u64>,
}

#[derive(Clone, Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GameState {
    pub game_id: GameId,
    pub status: GameStatus,
    pub initial_fen: String,
    pub moves: Vec<GameMove>,
    pub current_fen: String,
    pub ply: u32,
    pub turn: String,
    pub white_time: Option<u64>,
    pub black_time: Option<u64>,
    pub white_player: String,
    pub black_player: String,
}

#[derive(Clone, Debug, Serialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct GameMoveEvent {
    pub game_id: GameId,
    pub moves: Vec<GameMove>,
    pub fen: String,
    pub white_time: Option<u64>,
    pub black_time: Option<u64>,
}

#[derive(Clone, Debug, Serialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct ClockUpdateEvent {
    pub game_id: GameId,
    pub white_time: Option<u64>,
    pub black_time: Option<u64>,
}

#[derive(Clone, Debug, Serialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct GameOverEvent {
    pub game_id: GameId,
    pub result: GameResult,
    pub moves: Vec<GameMove>,
}

struct ClockState {
    white_time: Option<u64>,
    black_time: Option<u64>,
    white_increment: u64,
    black_increment: u64,
    last_tick: Instant,
}

struct GameController {
    game_id: GameId,
    config: GameConfig,
    initial_fen: String,
    moves: Vec<GameMove>,
    position: Chess,
    position_history: HashMap<String, u32>,
    status: GameStatus,
    clock: Option<ClockState>,
    white_engine: Option<Arc<Mutex<BaseEngine>>>,
    black_engine: Option<Arc<Mutex<BaseEngine>>>,
    shutdown_tx: Option<watch::Sender<bool>>,
    move_notify_tx: Option<tokio::sync::mpsc::Sender<()>>,
    engine_thinking: bool,
    polyglot_book: Option<PolyglotBook>,
    polyglot_max_ply: usize,
}

impl GameController {
    fn new(game_id: GameId, config: GameConfig) -> Result<Self, Error> {
        let initial_fen = config.initial_fen.clone().unwrap_or_else(|| {
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1".to_string()
        });

        let position = parse_fen_to_position(&initial_fen)?;

        let clock = if config.white_time_control.is_some() || config.black_time_control.is_some() {
            Some(ClockState {
                white_time: config.white_time_control.as_ref().map(|tc| tc.initial_time),
                black_time: config.black_time_control.as_ref().map(|tc| tc.initial_time),
                white_increment: config
                    .white_time_control
                    .as_ref()
                    .map(|tc| tc.increment)
                    .unwrap_or(0),
                black_increment: config
                    .black_time_control
                    .as_ref()
                    .map(|tc| tc.increment)
                    .unwrap_or(0),
                last_tick: Instant::now(),
            })
        } else {
            None
        };

        let mut position_history = HashMap::new();
        let initial_key = Self::position_key(&position);
        position_history.insert(initial_key, 1);

        let initial_moves = config.initial_moves.clone();

        let mut controller = Self {
            game_id,
            config,
            initial_fen,
            moves: Vec::new(),
            position,
            position_history,
            status: GameStatus::Playing,
            clock,
            white_engine: None,
            black_engine: None,
            shutdown_tx: None,
            move_notify_tx: None,
            engine_thinking: false,
            polyglot_book: None,
            polyglot_max_ply: 0,
        };

        for uci_str in &initial_moves {
            controller.apply_move_no_clock(uci_str)?;
        }

        Ok(controller)
    }

    fn get_state(&self) -> GameState {
        let turn = if self.position.turn() == Color::White {
            "white"
        } else {
            "black"
        };

        let (white_time, black_time) = self.get_current_times();

        let white_player = match &self.config.white {
            PlayerConfig::Human { name } => name.clone(),
            PlayerConfig::Engine { name, .. } => name.clone(),
        };

        let black_player = match &self.config.black {
            PlayerConfig::Human { name } => name.clone(),
            PlayerConfig::Engine { name, .. } => name.clone(),
        };

        GameState {
            game_id: self.game_id.clone(),
            status: self.status.clone(),
            initial_fen: self.initial_fen.clone(),
            moves: self.moves.clone(),
            current_fen: Fen::from_position(&self.position.clone(), EnPassantMode::Legal)
                .to_string(),
            ply: self.moves.len() as u32,
            turn: turn.to_string(),
            white_time,
            black_time,
            white_player,
            black_player,
        }
    }

    fn position_key(position: &Chess) -> String {
        let fen = Fen::from_position(&position.clone(), EnPassantMode::Legal).to_string();
        fen.split_whitespace().take(4).collect::<Vec<_>>().join(" ")
    }

    fn current_turn_player(&self) -> &PlayerConfig {
        if self.position.turn() == Color::White {
            &self.config.white
        } else {
            &self.config.black
        }
    }

    fn is_engine_turn(&self) -> bool {
        matches!(self.current_turn_player(), PlayerConfig::Engine { .. })
    }

    fn apply_move(&mut self, uci_str: &str) -> Result<GameMove, Error> {
        if self.status != GameStatus::Playing {
            return Err(Error::GameNotInProgress);
        }

        let uci = UciMove::from_ascii(uci_str.as_bytes())?;
        let mv = uci.to_move(&self.position)?;

        let san = SanPlus::from_move_and_play_unchecked(&mut self.position.clone(), mv);

        let clock = self.clock.as_ref().and_then(|c| {
            if self.position.turn() == Color::White {
                c.white_time
            } else {
                c.black_time
            }
        });

        self.position.play_unchecked(mv);

        let pos_key = Self::position_key(&self.position);
        *self.position_history.entry(pos_key).or_insert(0) += 1;

        if let Some(ref mut clock_state) = self.clock {
            let elapsed = clock_state.last_tick.elapsed().as_millis() as u64;

            if self.position.turn() == Color::Black {
                if let Some(ref mut wt) = clock_state.white_time {
                    *wt = wt.saturating_sub(elapsed);
                    *wt += clock_state.white_increment;
                }
            } else if let Some(ref mut bt) = clock_state.black_time {
                *bt = bt.saturating_sub(elapsed);
                *bt += clock_state.black_increment;
            }

            clock_state.last_tick = Instant::now();
        }

        let (white_time, black_time) = self
            .clock
            .as_ref()
            .map(|c| (c.white_time, c.black_time))
            .unwrap_or((None, None));

        let fen_after =
            Fen::from_position(&self.position.clone(), EnPassantMode::Legal).to_string();

        let game_move = GameMove {
            uci: uci_str.to_string(),
            san: san.to_string(),
            fen_after,
            clock,
            white_time,
            black_time,
        };

        self.moves.push(game_move.clone());
        self.check_game_end();

        Ok(game_move)
    }

    fn apply_move_no_clock(&mut self, uci_str: &str) -> Result<GameMove, Error> {
        let uci = UciMove::from_ascii(uci_str.as_bytes())?;
        let mv = uci.to_move(&self.position)?;

        let san = SanPlus::from_move_and_play_unchecked(&mut self.position.clone(), mv);

        self.position.play_unchecked(mv);

        let pos_key = Self::position_key(&self.position);
        *self.position_history.entry(pos_key).or_insert(0) += 1;

        let (white_time, black_time) = self
            .clock
            .as_ref()
            .map(|c| (c.white_time, c.black_time))
            .unwrap_or((None, None));

        let fen_after =
            Fen::from_position(&self.position.clone(), EnPassantMode::Legal).to_string();

        let game_move = GameMove {
            uci: uci_str.to_string(),
            san: san.to_string(),
            fen_after,
            clock: None,
            white_time,
            black_time,
        };

        self.moves.push(game_move.clone());
        self.check_game_end();

        Ok(game_move)
    }

    fn rebuild_position_from_moves(&mut self) -> Result<(), Error> {
        self.position = parse_fen_to_position(&self.initial_fen)?;

        self.position_history.clear();
        let initial_key = Self::position_key(&self.position);
        self.position_history.insert(initial_key, 1);

        for m in &self.moves {
            let uci = UciMove::from_ascii(m.uci.as_bytes())?;
            let mv = uci.to_move(&self.position)?;
            self.position.play_unchecked(mv);
            let pos_key = Self::position_key(&self.position);
            *self.position_history.entry(pos_key).or_insert(0) += 1;
        }

        if let Some(ref mut clock) = self.clock {
            clock.white_time = self
                .config
                .white_time_control
                .as_ref()
                .map(|tc| tc.initial_time);
            clock.black_time = self
                .config
                .black_time_control
                .as_ref()
                .map(|tc| tc.initial_time);

            if let Some(last_move) = self.moves.last() {
                if last_move.white_time.is_some() || last_move.black_time.is_some() {
                    clock.white_time = last_move.white_time;
                    clock.black_time = last_move.black_time;
                }
            }

            clock.last_tick = Instant::now();
        }

        Ok(())
    }

    fn check_game_end(&mut self) {
        if self.position.is_checkmate() {
            let result = if self.position.turn() == Color::White {
                GameResult::BlackWins {
                    reason: GameEndReason::Checkmate,
                }
            } else {
                GameResult::WhiteWins {
                    reason: GameEndReason::Checkmate,
                }
            };
            self.status = GameStatus::Finished { result };
            return;
        }

        if self.position.is_stalemate() {
            self.status = GameStatus::Finished {
                result: GameResult::Draw {
                    reason: DrawReason::Stalemate,
                },
            };
            return;
        }

        if self.position.is_insufficient_material() {
            self.status = GameStatus::Finished {
                result: GameResult::Draw {
                    reason: DrawReason::InsufficientMaterial,
                },
            };
            return;
        }

        if self.position.halfmoves() >= 100 {
            self.status = GameStatus::Finished {
                result: GameResult::Draw {
                    reason: DrawReason::FiftyMoveRule,
                },
            };
            return;
        }

        let pos_key = Self::position_key(&self.position);
        if let Some(&count) = self.position_history.get(&pos_key) {
            if count >= 3 {
                self.status = GameStatus::Finished {
                    result: GameResult::Draw {
                        reason: DrawReason::ThreefoldRepetition,
                    },
                };
            }
        }
    }

    fn check_timeout(&mut self) -> Option<GameResult> {
        if let Some(ref clock) = self.clock {
            let elapsed = clock.last_tick.elapsed().as_millis() as u64;

            if self.position.turn() == Color::White {
                if let Some(wt) = clock.white_time {
                    if wt.saturating_sub(elapsed) == 0 {
                        return Some(GameResult::BlackWins {
                            reason: GameEndReason::Timeout,
                        });
                    }
                }
            } else if let Some(bt) = clock.black_time {
                if bt.saturating_sub(elapsed) == 0 {
                    return Some(GameResult::WhiteWins {
                        reason: GameEndReason::Timeout,
                    });
                }
            }
        }
        None
    }

    fn get_current_times(&self) -> (Option<u64>, Option<u64>) {
        if let Some(ref clock) = self.clock {
            let elapsed = clock.last_tick.elapsed().as_millis() as u64;

            let white_time = if self.position.turn() == Color::White {
                clock.white_time.map(|t| t.saturating_sub(elapsed))
            } else {
                clock.white_time
            };

            let black_time = if self.position.turn() == Color::Black {
                clock.black_time.map(|t| t.saturating_sub(elapsed))
            } else {
                clock.black_time
            };

            (white_time, black_time)
        } else {
            (None, None)
        }
    }

    fn end_game(&mut self, result: GameResult) {
        self.status = GameStatus::Finished { result };
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(true);
        }
    }

    fn reset_clock(&mut self) {
        if let Some(ref mut clock) = self.clock {
            clock.last_tick = Instant::now();
        }
    }
}

pub struct GameManager {
    games: DashMap<GameId, Arc<RwLock<GameController>>>,
}

impl GameManager {
    pub fn new() -> Self {
        Self {
            games: DashMap::new(),
        }
    }

    pub async fn start_game(
        &self,
        game_id: GameId,
        config: GameConfig,
        app: AppHandle,
    ) -> Result<GameState, Error> {
        if let Some((_, old_game)) = self.games.remove(&game_id) {
            let mut game = old_game.write().await;
            if let Some(tx) = game.shutdown_tx.take() {
                let _ = tx.send(true);
            }
        }

        let OpeningBookResult {
            config,
            polyglot_book,
            polyglot_max_ply,
        } = apply_opening_book(config)?;
        let castling_mode = CastlingMode::detect(
            config
                .clone()
                .initial_fen
                .unwrap_or_default()
                .parse::<Fen>()
                .unwrap_or_default()
                .as_setup(),
        );

        let mut controller = GameController::new(game_id.clone(), config.clone())?;
        controller.polyglot_book = polyglot_book;
        controller.polyglot_max_ply = polyglot_max_ply;

        if let PlayerConfig::Engine { path, options, .. } = &config.white {
            let mut engine = BaseEngine::spawn(PathBuf::from(path)).await?;
            engine.init_uci().await?;
            for opt in options {
                if opt.name == "UCI_Chess960" {
                    continue;
                }
                engine.set_option(&opt.name, &opt.value).await?;
            }
            if castling_mode.is_chess960() {
                engine.set_option("UCI_Chess960", "true").await?;
            } else {
                engine.set_option("UCI_Chess960", "false").await?;
            }
            controller.white_engine = Some(Arc::new(Mutex::new(engine)));
        }

        if let PlayerConfig::Engine { path, options, .. } = &config.black {
            let mut engine = BaseEngine::spawn(PathBuf::from(path)).await?;
            engine.init_uci().await?;
            for opt in options {
                if opt.name == "UCI_Chess960" {
                    continue;
                }
                engine.set_option(&opt.name, &opt.value).await?;
            }
            if castling_mode.is_chess960() {
                engine.set_option("UCI_Chess960", "true").await?;
            } else {
                engine.set_option("UCI_Chess960", "false").await?;
            }
            controller.black_engine = Some(Arc::new(Mutex::new(engine)));
        }

        controller.reset_clock();

        let (shutdown_tx, shutdown_rx) = watch::channel(false);
        controller.shutdown_tx = Some(shutdown_tx);

        let (move_notify_tx, move_notify_rx) = tokio::sync::mpsc::channel(1);
        controller.move_notify_tx = Some(move_notify_tx);

        let state = controller.get_state();
        let controller = Arc::new(RwLock::new(controller));
        self.games.insert(game_id.clone(), controller.clone());

        tokio::spawn(game_loop(
            game_id,
            controller,
            shutdown_rx,
            move_notify_rx,
            app,
        ));

        Ok(state)
    }

    pub async fn get_game_state(&self, game_id: &str) -> Result<GameState, Error> {
        let game = self
            .games
            .get(game_id)
            .ok_or_else(|| Error::GameNotFound(game_id.to_string()))?;
        let controller = game.read().await;
        Ok(controller.get_state())
    }

    pub async fn make_move(
        &self,
        game_id: &str,
        uci: &str,
        app: &AppHandle,
    ) -> Result<GameState, Error> {
        let game = self
            .games
            .get(game_id)
            .ok_or_else(|| Error::GameNotFound(game_id.to_string()))?;

        let mut controller = game.write().await;

        if controller.is_engine_turn() {
            return Err(Error::NotHumanTurn);
        }

        let game_move = controller.apply_move(uci)?;
        let (white_time, black_time) = controller.get_current_times();

        GameMoveEvent {
            game_id: game_id.to_string(),
            moves: controller.moves.clone(),
            fen: game_move.fen_after,
            white_time,
            black_time,
        }
        .emit(app)?;

        if let GameStatus::Finished { result } = &controller.status {
            GameOverEvent {
                game_id: game_id.to_string(),
                result: result.clone(),
                moves: controller.moves.clone(),
            }
            .emit(app)?;
        } else if let Some(tx) = &controller.move_notify_tx {
            let _ = tx.try_send(());
        }

        Ok(controller.get_state())
    }

    pub async fn take_back_move(&self, game_id: &str, app: &AppHandle) -> Result<GameState, Error> {
        let game = self
            .games
            .get(game_id)
            .ok_or_else(|| Error::GameNotFound(game_id.to_string()))?;

        let mut controller = game.write().await;

        if controller.moves.is_empty() {
            return Err(Error::NoMovesFound);
        }

        let human_color = match (&controller.config.white, &controller.config.black) {
            (PlayerConfig::Human { .. }, PlayerConfig::Engine { .. }) => Some(Color::White),
            (PlayerConfig::Engine { .. }, PlayerConfig::Human { .. }) => Some(Color::Black),
            _ => None,
        };

        let should_pop_two = human_color
            .map(|c| controller.position.turn() == c)
            .unwrap_or(false);

        controller.moves.pop();
        if should_pop_two {
            controller.moves.pop();
        }
        controller.status = GameStatus::Playing;
        controller.engine_thinking = false;

        controller.rebuild_position_from_moves()?;
        controller.check_game_end();

        let (white_time, black_time) = controller.get_current_times();
        let fen =
            Fen::from_position(&controller.position.clone(), EnPassantMode::Legal).to_string();

        GameMoveEvent {
            game_id: game_id.to_string(),
            moves: controller.moves.clone(),
            fen,
            white_time,
            black_time,
        }
        .emit(app)?;

        if let GameStatus::Finished { result } = &controller.status {
            GameOverEvent {
                game_id: game_id.to_string(),
                result: result.clone(),
                moves: controller.moves.clone(),
            }
            .emit(app)?;
        } else if controller.is_engine_turn() {
            if let Some(tx) = &controller.move_notify_tx {
                let _ = tx.try_send(());
            }
        }

        Ok(controller.get_state())
    }

    pub async fn resign(
        &self,
        game_id: &str,
        color: &str,
        app: &AppHandle,
    ) -> Result<GameState, Error> {
        let game = self
            .games
            .get(game_id)
            .ok_or_else(|| Error::GameNotFound(game_id.to_string()))?;

        let mut controller = game.write().await;

        let result = match color {
            "white" => GameResult::BlackWins {
                reason: GameEndReason::Resignation,
            },
            "black" => GameResult::WhiteWins {
                reason: GameEndReason::Resignation,
            },
            _ => return Err(Error::InvalidColor(color.to_string())),
        };

        controller.end_game(result.clone());

        GameOverEvent {
            game_id: game_id.to_string(),
            result,
            moves: controller.moves.clone(),
        }
        .emit(app)?;

        Ok(controller.get_state())
    }

    pub async fn abort_game(&self, game_id: &str) -> Result<(), Error> {
        if let Some((_, game)) = self.games.remove(game_id) {
            let mut controller = game.write().await;
            if let Some(tx) = controller.shutdown_tx.take() {
                let _ = tx.send(true);
            }

            if let Some(engine) = &controller.white_engine {
                let mut proc = engine.lock().await;
                let _ = proc.quit().await;
            }
            if let Some(engine) = &controller.black_engine {
                let mut proc = engine.lock().await;
                let _ = proc.quit().await;
            }
        }
        Ok(())
    }

    pub async fn get_engine_logs(
        &self,
        game_id: &str,
        color: &str,
    ) -> Result<Vec<EngineLog>, Error> {
        let game = self
            .games
            .get(game_id)
            .ok_or_else(|| Error::GameNotFound(game_id.to_string()))?;

        let controller = game.read().await;

        let engine = match color {
            "white" => &controller.white_engine,
            "black" => &controller.black_engine,
            _ => return Err(Error::InvalidColor(color.to_string())),
        };

        if let Some(engine_arc) = engine {
            let engine = engine_arc.lock().await;
            Ok(engine.get_logs())
        } else {
            Ok(Vec::new())
        }
    }
}

impl Default for GameManager {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Clone, Debug)]
struct OpeningBookSelection {
    initial_fen: String,
    initial_moves: Vec<String>,
}

struct OpeningBookResult {
    config: GameConfig,
    polyglot_book: Option<PolyglotBook>,
    polyglot_max_ply: usize,
}

fn select_random_epd_entry(reader: impl BufRead) -> Result<OpeningBookSelection, Error> {
    let mut rng = rand::thread_rng();

    let selected_line = reader
        .lines()
        .map_while(Result::ok)
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .choose(&mut rng)
        .ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "Opening book EPD has no entries",
            )
        })?;

    Ok(OpeningBookSelection {
        initial_fen: selected_line,
        initial_moves: Vec::new(),
    })
}

struct OpeningBookPgnVisitor {
    selected: Option<OpeningBookSelection>,
    seen: usize,
    current_position: Chess,
    initial_position: Chess,
    castling_mode: CastlingMode,
    initial_fen: Option<String>,
    moves: Vec<String>,
    skip: bool,
}

impl OpeningBookPgnVisitor {
    fn new() -> Self {
        let start = Chess::default();
        Self {
            selected: None,
            seen: 0,
            current_position: start.clone(),
            initial_position: start,
            castling_mode: CastlingMode::Standard,
            initial_fen: None,
            moves: Vec::new(),
            skip: false,
        }
    }
}

impl Visitor for OpeningBookPgnVisitor {
    type Output = Option<OpeningBookSelection>;
    type Tags = ();
    type Movetext = ();

    fn begin_tags(&mut self) -> ControlFlow<Self::Output, Self::Tags> {
        let start = Chess::default();
        self.current_position = start.clone();
        self.initial_position = start;
        self.castling_mode = CastlingMode::Standard;
        self.initial_fen = None;
        self.moves.clear();
        self.skip = false;
        ControlFlow::Continue(())
    }

    fn tag(
        &mut self,
        _tags: &mut Self::Tags,
        key: &[u8],
        value: RawTag<'_>,
    ) -> ControlFlow<Self::Output> {
        if key == b"FEN" {
            // RawTag is bytes in 0.30, need manual conversion
            let fen_text = String::from_utf8_lossy(value.as_bytes()).into_owned();

            match parse_fen_to_position(&fen_text) {
                Ok(position) => {
                    let parsed_fen: Fen = match fen_text.parse() {
                        Ok(fen) => fen,
                        Err(_) => {
                            self.skip = true;
                            return ControlFlow::Continue(());
                        }
                    };
                    self.current_position = position.clone();
                    self.initial_position = position;
                    self.castling_mode = CastlingMode::detect(parsed_fen.as_setup());
                    self.initial_fen = Some(fen_text);
                }
                Err(_) => {
                    self.skip = true;
                }
            }
        }
        ControlFlow::Continue(())
    }

    fn begin_movetext(&mut self, _tags: Self::Tags) -> ControlFlow<Self::Output, Self::Movetext> {
        ControlFlow::Continue(())
    }

    fn begin_variation(
        &mut self,
        _movetext: &mut Self::Movetext,
    ) -> ControlFlow<Self::Output, Skip> {
        // Skip parsing moves if self.skip was set during headers
        ControlFlow::Continue(Skip(self.skip))
    }

    fn san(&mut self, _movetext: &mut Self::Movetext, san: SanPlus) -> ControlFlow<Self::Output> {
        // Double check skip, though begin_variation handles most cases
        if self.skip {
            return ControlFlow::Continue(());
        }

        let mv = match san.san.to_move(&self.current_position) {
            Ok(mv) => mv,
            Err(_) => {
                self.skip = true;
                return ControlFlow::Continue(());
            }
        };

        let uci = UciMove::from_move(mv, self.castling_mode).to_string();
        self.moves.push(uci);
        self.current_position.play_unchecked(mv);

        ControlFlow::Continue(())
    }

    fn end_game(&mut self, _movetext: Self::Movetext) -> Self::Output {
        if self.skip || self.moves.is_empty() {
            return None;
        }

        let initial_fen = self.initial_fen.clone().unwrap_or_else(|| {
            Fen::from_position(&self.initial_position, EnPassantMode::Legal).to_string()
        });

        let candidate = OpeningBookSelection {
            initial_fen,
            initial_moves: self.moves.clone(),
        };

        self.seen += 1;
        let mut rng = rand::thread_rng();
        if rng.gen_range(0..self.seen) == 0 {
            self.selected = Some(candidate.clone());
        }

        Some(candidate)
    }
}

fn select_random_pgn_entry(input: impl Read) -> Result<OpeningBookSelection, Error> {
    let mut reader = Reader::new(input);
    let mut visitor = OpeningBookPgnVisitor::new();

    while reader.read_game(&mut visitor)?.is_some() {}

    visitor.selected.ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Opening book PGN has no valid games",
        )
        .into()
    })
}

fn read_zip_inner(path: &str) -> Result<(String, Vec<u8>), Error> {
    let file = File::open(path)?;
    let mut archive = zip::ZipArchive::new(BufReader::new(file))?;
    if archive.len() != 1 {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Opening book zip must contain exactly one file",
        )
        .into());
    }
    let mut inner = archive.by_index(0)?;
    let name = inner.name().to_string();
    let mut buf = Vec::new();
    inner.read_to_end(&mut buf)?;
    Ok((name, buf))
}

fn opening_book_ext(name: &str) -> Option<&str> {
    let lower = name.to_ascii_lowercase();
    if lower.ends_with(".epd") {
        Some("epd")
    } else if lower.ends_with(".pgn") {
        Some("pgn")
    } else if lower.ends_with(".bin") {
        Some("bin")
    } else {
        None
    }
}

fn normalize_polyglot_uci(uci: &str) -> String {
    match uci {
        "e1h1" => "e1g1".to_string(),
        "e1a1" => "e1c1".to_string(),
        "e8h8" => "e8g8".to_string(),
        "e8a8" => "e8c8".to_string(),
        _ => uci.to_string(),
    }
}

fn choose_weighted_index(weights: &[u16], rng: &mut impl Rng) -> usize {
    let total: u64 = weights.iter().map(|w| *w as u64).sum();
    if total == 0 {
        return rng.gen_range(0..weights.len());
    }

    let mut target = rng.gen_range(0..total);
    for (index, weight) in weights.iter().enumerate() {
        let weight = *weight as u64;
        if target < weight {
            return index;
        }
        target -= weight;
    }

    weights.len().saturating_sub(1)
}

fn apply_opening_book(config: GameConfig) -> Result<OpeningBookResult, Error> {
    let Some(opening_book) = &config.opening_book else {
        return Ok(OpeningBookResult {
            config,
            polyglot_book: None,
            polyglot_max_ply: 0,
        });
    };

    let path = &opening_book.path;
    let max_ply = opening_book.max_ply.max(1);
    let ext = PathBuf::from(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase());

    let is_human_vs_human = matches!(
        (&config.white, &config.black),
        (PlayerConfig::Human { .. }, PlayerConfig::Human { .. })
    );

    enum BookAction {
        Selection(OpeningBookSelection),
        Polyglot(PolyglotBook),
        Skip,
    }

    let action = match ext.as_deref() {
        Some("epd") => {
            BookAction::Selection(select_random_epd_entry(BufReader::new(File::open(path)?))?)
        }
        Some("pgn") => BookAction::Selection(select_random_pgn_entry(File::open(path)?)?),
        Some("bin") => {
            if is_human_vs_human {
                BookAction::Skip
            } else {
                BookAction::Polyglot(PolyglotBook::load(path)?)
            }
        }
        Some("zip") => {
            let (inner_name, data) = read_zip_inner(path)?;
            match opening_book_ext(&inner_name) {
                Some("epd") => BookAction::Selection(select_random_epd_entry(BufReader::new(
                    Cursor::new(data),
                ))?),
                Some("pgn") => BookAction::Selection(select_random_pgn_entry(Cursor::new(data))?),
                Some("bin") => {
                    if is_human_vs_human {
                        BookAction::Skip
                    } else {
                        let mut temp = tempfile::NamedTempFile::new()?;
                        temp.write_all(&data)?;
                        temp.flush()?;
                        let temp_path = temp.path().to_str().ok_or_else(|| {
                            std::io::Error::new(
                                std::io::ErrorKind::InvalidData,
                                "Temporary Polyglot book path is not valid UTF-8",
                            )
                        })?;
                        BookAction::Polyglot(PolyglotBook::load(temp_path)?)
                    }
                }
                _ => {
                    return Err(std::io::Error::new(
                        std::io::ErrorKind::InvalidInput,
                        "Zip must contain a .pgn, .epd, or .bin file",
                    )
                    .into())
                }
            }
        }
        _ => {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Unsupported opening book format. Use .pgn, .epd, .bin, or .zip",
            )
            .into())
        }
    };

    match action {
        BookAction::Selection(selection) => {
            let mut next = config;
            next.initial_fen = Some(selection.initial_fen);
            next.initial_moves = selection.initial_moves;
            Ok(OpeningBookResult {
                config: next,
                polyglot_book: None,
                polyglot_max_ply: 0,
            })
        }
        BookAction::Polyglot(book) => Ok(OpeningBookResult {
            config,
            polyglot_book: Some(book),
            polyglot_max_ply: max_ply,
        }),
        BookAction::Skip => Ok(OpeningBookResult {
            config,
            polyglot_book: None,
            polyglot_max_ply: 0,
        }),
    }
}

fn spawn_engine_task(
    game_id: &GameId,
    controller: &Arc<RwLock<GameController>>,
    app: &AppHandle,
) -> tokio::task::JoinHandle<Result<(), Error>> {
    let game_id_clone = game_id.clone();
    let controller_clone = controller.clone();
    let app_clone = app.clone();
    tokio::spawn(
        async move { request_engine_move(&game_id_clone, &controller_clone, &app_clone).await },
    )
}

async fn maybe_start_engine(
    controller: &Arc<RwLock<GameController>>,
    engine_task: &Option<tokio::task::JoinHandle<Result<(), Error>>>,
) -> bool {
    let mut ctrl = controller.write().await;
    if ctrl.status == GameStatus::Playing
        && ctrl.is_engine_turn()
        && !ctrl.engine_thinking
        && engine_task.is_none()
    {
        ctrl.engine_thinking = true;
        true
    } else {
        false
    }
}

async fn game_loop(
    game_id: GameId,
    controller: Arc<RwLock<GameController>>,
    mut shutdown_rx: watch::Receiver<bool>,
    mut move_notify_rx: tokio::sync::mpsc::Receiver<()>,
    app: AppHandle,
) {
    let mut clock_interval = interval(Duration::from_millis(100));
    let mut engine_task: Option<tokio::task::JoinHandle<Result<(), Error>>> = None;

    if maybe_start_engine(&controller, &engine_task).await {
        engine_task = Some(spawn_engine_task(&game_id, &controller, &app));
    }

    loop {
        tokio::select! {
            biased;

            _ = shutdown_rx.changed() => {
                if *shutdown_rx.borrow() {
                    info!("Game {} shutting down", game_id);
                    if let Some(task) = engine_task.take() {
                        task.abort();
                    }
                    break;
                }
            }

            result = async {
                if let Some(ref mut task) = engine_task {
                    Some(task.await)
                } else {
                    std::future::pending::<Option<Result<Result<(), Error>, tokio::task::JoinError>>>().await
                }
            } => {
                engine_task = None;

                match result {
                    Some(Ok(Ok(()))) => {
                        if maybe_start_engine(&controller, &engine_task).await {
                            engine_task = Some(spawn_engine_task(&game_id, &controller, &app));
                        }
                    }
                    Some(Ok(Err(e))) => {
                        error!("Engine move error: {:?}", e);
                        let mut ctrl = controller.write().await;
                        ctrl.engine_thinking = false;
                        let result = if ctrl.position.turn() == Color::White {
                            GameResult::BlackWins { reason: GameEndReason::Abandonment }
                        } else {
                            GameResult::WhiteWins { reason: GameEndReason::Abandonment }
                        };
                        ctrl.end_game(result.clone());
                        let _ = GameOverEvent { game_id: game_id.clone(), result, moves: ctrl.moves.clone() }.emit(&app);
                        break;
                    }
                    Some(Err(_join_error)) => {
                        let mut ctrl = controller.write().await;
                        ctrl.engine_thinking = false;
                        let result = if ctrl.position.turn() == Color::White {
                            GameResult::BlackWins { reason: GameEndReason::Abandonment }
                        } else {
                            GameResult::WhiteWins { reason: GameEndReason::Abandonment }
                        };
                        ctrl.end_game(result.clone());
                        let _ = GameOverEvent { game_id: game_id.clone(), result, moves: ctrl.moves.clone() }.emit(&app);
                        break;
                    }
                    None => unreachable!(),
                }
            }

            _ = move_notify_rx.recv() => {
                if engine_task.is_none() && maybe_start_engine(&controller, &engine_task).await {
                    engine_task = Some(spawn_engine_task(&game_id, &controller, &app));
                }
            }

            _ = clock_interval.tick() => {
                let is_finished;

                {
                    let mut ctrl = controller.write().await;

                    if ctrl.status != GameStatus::Playing {
                        break;
                    }

                    if let Some(result) = ctrl.check_timeout() {
                        ctrl.end_game(result.clone());
                        let _ = GameOverEvent { game_id: game_id.clone(), result, moves: ctrl.moves.clone() }.emit(&app);
                        break;
                    }

                    let (white_time, black_time) = ctrl.get_current_times();
                    let _ = ClockUpdateEvent {
                        game_id: game_id.clone(),
                        white_time,
                        black_time,
                    }.emit(&app);

                    is_finished = ctrl.status != GameStatus::Playing;
                }

                if is_finished {
                    break;
                }
            }
        }
    }

    if let Some(task) = engine_task.take() {
        task.abort();
    }

    {
        let ctrl = controller.read().await;
        if let Some(engine) = &ctrl.white_engine {
            let mut proc = engine.lock().await;
            let _ = proc.quit().await;
        }
        if let Some(engine) = &ctrl.black_engine {
            let mut proc = engine.lock().await;
            let _ = proc.quit().await;
        }
    }

    info!("Game loop ended for {}", game_id);
}

fn try_polyglot_book_move(controller: &GameController) -> Option<String> {
    let book = controller.polyglot_book.as_ref()?;

    if controller.moves.len() >= controller.polyglot_max_ply {
        return None;
    }

    let fen = Fen::from_position(&controller.position, EnPassantMode::Legal).to_string();
    let entries = book.get_all_moves_from_fen(&fen);

    if entries.is_empty() {
        return None;
    }

    let mut rng = rand::thread_rng();
    let legal_moves = entries
        .into_iter()
        .filter_map(|entry| {
            let uci = normalize_polyglot_uci(&entry.move_string);
            let parsed = UciMove::from_ascii(uci.as_bytes()).ok()?;
            parsed.to_move(&controller.position).ok()?;
            Some((uci, entry.weight))
        })
        .collect::<Vec<_>>();

    if legal_moves.is_empty() {
        return None;
    }

    let weights = legal_moves.iter().map(|(_, w)| *w).collect::<Vec<_>>();
    let selected = choose_weighted_index(&weights, &mut rng);
    Some(legal_moves[selected].0.clone())
}

async fn request_engine_move(
    game_id: &str,
    controller: &Arc<RwLock<GameController>>,
    app: &AppHandle,
) -> Result<(), Error> {
    // Try polyglot book move first (only for engine turns with a loaded book)
    {
        let ctrl = controller.read().await;
        let book_move = try_polyglot_book_move(&ctrl);
        let turn = ctrl.position.turn();
        drop(ctrl);

        if let Some(book_uci) = book_move {
            let mut ctrl = controller.write().await;
            ctrl.engine_thinking = false;

            if ctrl.status != GameStatus::Playing || ctrl.position.turn() != turn {
                return Ok(());
            }

            let game_move = ctrl.apply_move(&book_uci)?;
            let (white_time, black_time) = ctrl.get_current_times();

            GameMoveEvent {
                game_id: game_id.to_string(),
                moves: ctrl.moves.clone(),
                fen: game_move.fen_after,
                white_time,
                black_time,
            }
            .emit(app)?;

            if let GameStatus::Finished { result } = &ctrl.status {
                GameOverEvent {
                    game_id: game_id.to_string(),
                    result: result.clone(),
                    moves: ctrl.moves.clone(),
                }
                .emit(app)?;
            }

            return Ok(());
        }
    }

    let (engine_arc, go_mode, initial_fen, moves, turn) = {
        let ctrl = controller.read().await;

        if ctrl.status != GameStatus::Playing {
            return Ok(());
        }

        let turn = ctrl.position.turn();
        let (engine_arc, player_config) = if turn == Color::White {
            (ctrl.white_engine.clone(), ctrl.config.white.clone())
        } else {
            (ctrl.black_engine.clone(), ctrl.config.black.clone())
        };

        let engine = match engine_arc {
            Some(e) => e,
            None => return Err(Error::EngineNotInitialized),
        };

        let go = match player_config {
            PlayerConfig::Engine { go, .. } => go,
            _ => return Err(Error::NotEngineTurn),
        };

        let initial_fen = ctrl.initial_fen.clone();
        let moves: Vec<String> = ctrl.moves.iter().map(|m| m.uci.clone()).collect();
        let (white_time, black_time) = ctrl.get_current_times();

        let current_time = if turn == Color::White {
            white_time
        } else {
            black_time
        };

        let go_mode = if current_time.is_some() {
            let (winc, binc) = ctrl
                .clock
                .as_ref()
                .map(|c| (c.white_increment as u32, c.black_increment as u32))
                .unwrap_or((0, 0));

            let wt = white_time.unwrap_or(u64::MAX) as u32;
            let bt = black_time.unwrap_or(u64::MAX) as u32;
            GoMode::PlayersTime(PlayersTime::new(wt, bt, winc, binc))
        } else {
            go.unwrap_or(GoMode::Depth(20))
        };

        (engine, go_mode, initial_fen, moves, turn)
    };

    let best_move = {
        let mut engine = engine_arc.lock().await;
        engine.set_position(&initial_fen, &moves).await?;
        engine.go(&go_mode).await?;
        engine.wait_for_bestmove().await?
    };

    let mut ctrl = controller.write().await;
    ctrl.engine_thinking = false;

    if ctrl.status != GameStatus::Playing {
        return Ok(());
    }

    if ctrl.position.turn() != turn {
        return Ok(());
    }

    let game_move = ctrl.apply_move(&best_move)?;
    let (white_time, black_time) = ctrl.get_current_times();

    GameMoveEvent {
        game_id: game_id.to_string(),
        moves: ctrl.moves.clone(),
        fen: game_move.fen_after,
        white_time,
        black_time,
    }
    .emit(app)?;

    if let GameStatus::Finished { result } = &ctrl.status {
        GameOverEvent {
            game_id: game_id.to_string(),
            result: result.clone(),
            moves: ctrl.moves.clone(),
        }
        .emit(app)?;
    }

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn start_game(
    game_id: String,
    config: GameConfig,
    app: AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<GameState, Error> {
    info!("Starting game with ID {}", game_id);
    state.game_manager.start_game(game_id, config, app).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_game_state(
    game_id: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<GameState, Error> {
    state.game_manager.get_game_state(&game_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn make_game_move(
    game_id: String,
    uci: String,
    app: AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<GameState, Error> {
    state.game_manager.make_move(&game_id, &uci, &app).await
}

#[tauri::command]
#[specta::specta]
pub async fn take_back_game_move(
    game_id: String,
    app: AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<GameState, Error> {
    state.game_manager.take_back_move(&game_id, &app).await
}

#[tauri::command]
#[specta::specta]
pub async fn resign_game(
    game_id: String,
    color: String,
    app: AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<GameState, Error> {
    state.game_manager.resign(&game_id, &color, &app).await
}

#[tauri::command]
#[specta::specta]
pub async fn abort_game(
    game_id: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), Error> {
    state.game_manager.abort_game(&game_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_game_engine_logs(
    game_id: String,
    color: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<EngineLog>, Error> {
    state.game_manager.get_engine_logs(&game_id, &color).await
}
