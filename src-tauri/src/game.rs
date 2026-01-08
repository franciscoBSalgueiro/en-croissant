use std::{collections::HashMap, path::PathBuf, sync::Arc, time::Instant};

use dashmap::DashMap;
use log::{error, info};
use serde::{Deserialize, Serialize};
use shakmaty::{
    fen::Fen, san::SanPlus, uci::UciMove, Chess, Color, EnPassantMode, Position,
};
use specta::Type;
use tauri::AppHandle;
use tauri_specta::Event;
use tokio::{
    sync::{watch, Mutex, RwLock},
    time::{interval, Duration},
};

use crate::{
    engine::{parse_fen_to_position, BaseEngine, EngineOption, GoMode, PlayersTime},
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

impl GameResult {
    pub fn to_outcome_string(&self) -> String {
        match self {
            GameResult::WhiteWins { .. } => "1-0".to_string(),
            GameResult::BlackWins { .. } => "0-1".to_string(),
            GameResult::Draw { .. } => "1/2-1/2".to_string(),
        }
    }
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

#[derive(Clone, Debug, Serialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct GameStartedEvent {
    pub game_id: GameId,
    pub initial_fen: String,
    pub white_player: String,
    pub black_player: String,
    pub white_time: Option<u64>,
    pub black_time: Option<u64>,
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

        Ok(Self {
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
        })
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
            current_fen: Fen::from_position(self.position.clone(), EnPassantMode::Legal).to_string(),
            ply: self.moves.len() as u32,
            turn: turn.to_string(),
            white_time,
            black_time,
            white_player,
            black_player,
        }
    }

    fn position_key(position: &Chess) -> String {
        let fen = Fen::from_position(position.clone(), EnPassantMode::Legal).to_string();
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

        let san = SanPlus::from_move_and_play_unchecked(&mut self.position.clone(), &mv);

        let clock = self.clock.as_ref().and_then(|c| {
            if self.position.turn() == Color::White {
                c.white_time
            } else {
                c.black_time
            }
        });

        self.position.play_unchecked(&mv);

        let pos_key = Self::position_key(&self.position);
        *self.position_history.entry(pos_key).or_insert(0) += 1;

        if let Some(ref mut clock_state) = self.clock {
            let elapsed = clock_state.last_tick.elapsed().as_millis() as u64;

            if self.position.turn() == Color::Black {
                if let Some(ref mut wt) = clock_state.white_time {
                    *wt = wt.saturating_sub(elapsed);
                    *wt += clock_state.white_increment;
                }
            } else {
                if let Some(ref mut bt) = clock_state.black_time {
                    *bt = bt.saturating_sub(elapsed);
                    *bt += clock_state.black_increment;
                }
            }

            clock_state.last_tick = Instant::now();
        }

        let (white_time, black_time) = self
            .clock
            .as_ref()
            .map(|c| (c.white_time, c.black_time))
            .unwrap_or((None, None));

        let fen_after =
            Fen::from_position(self.position.clone(), EnPassantMode::Legal).to_string();

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

    fn rebuild_position_from_moves(&mut self) -> Result<(), Error> {
        self.position = parse_fen_to_position(&self.initial_fen)?;

        self.position_history.clear();
        let initial_key = Self::position_key(&self.position);
        self.position_history.insert(initial_key, 1);

        for m in &self.moves {
            let uci = UciMove::from_ascii(m.uci.as_bytes())?;
            let mv = uci.to_move(&self.position)?;
            self.position.play_unchecked(&mv);
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

        let mut controller = GameController::new(game_id.clone(), config.clone())?;

        let white_player = match &controller.config.white {
            PlayerConfig::Human { name } => name.clone(),
            PlayerConfig::Engine { name, .. } => name.clone(),
        };

        let black_player = match &controller.config.black {
            PlayerConfig::Human { name } => name.clone(),
            PlayerConfig::Engine { name, .. } => name.clone(),
        };

        let (white_time, black_time) = controller.get_current_times();

        if let PlayerConfig::Engine { path, options, .. } = &config.white {
            let mut engine = BaseEngine::spawn(PathBuf::from(path)).await?;
            engine.init_uci().await?;
            for opt in options {
                engine.set_option(&opt.name, &opt.value).await?;
            }
            controller.white_engine = Some(Arc::new(Mutex::new(engine)));
        }

        if let PlayerConfig::Engine { path, options, .. } = &config.black {
            let mut engine = BaseEngine::spawn(PathBuf::from(path)).await?;
            engine.init_uci().await?;
            for opt in options {
                engine.set_option(&opt.name, &opt.value).await?;
            }
            controller.black_engine = Some(Arc::new(Mutex::new(engine)));
        }

        controller.reset_clock();

        GameStartedEvent {
            game_id: game_id.clone(),
            initial_fen: controller.initial_fen.clone(),
            white_player,
            black_player,
            white_time,
            black_time,
        }
        .emit(&app)?;

        let (shutdown_tx, shutdown_rx) = watch::channel(false);
        controller.shutdown_tx = Some(shutdown_tx);

        let (move_notify_tx, move_notify_rx) = tokio::sync::mpsc::channel(1);
        controller.move_notify_tx = Some(move_notify_tx);

        let state = controller.get_state();
        let controller = Arc::new(RwLock::new(controller));
        self.games.insert(game_id.clone(), controller.clone());

        tokio::spawn(game_loop(game_id, controller, shutdown_rx, move_notify_rx, app));

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
        } else {
            if let Some(tx) = &controller.move_notify_tx {
                let _ = tx.try_send(());
            }
        }

        Ok(controller.get_state())
    }

    pub async fn take_back_move(
        &self,
        game_id: &str,
        app: &AppHandle,
    ) -> Result<GameState, Error> {
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
        let fen = Fen::from_position(controller.position.clone(), EnPassantMode::Legal).to_string();

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
}

impl Default for GameManager {
    fn default() -> Self {
        Self::new()
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
    tokio::spawn(async move {
        request_engine_move(&game_id_clone, &controller_clone, &app_clone).await
    })
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
                if engine_task.is_none() {
                    if maybe_start_engine(&controller, &engine_task).await {
                        engine_task = Some(spawn_engine_task(&game_id, &controller, &app));
                    }
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

async fn request_engine_move(
    game_id: &str,
    controller: &Arc<RwLock<GameController>>,
    app: &AppHandle,
) -> Result<(), Error> {
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

        let go_mode = if let (Some(wt), Some(bt)) = (white_time, black_time) {
            let (winc, binc) = ctrl
                .clock
                .as_ref()
                .map(|c| (c.white_increment as u32, c.black_increment as u32))
                .unwrap_or((0, 0));

            GoMode::PlayersTime(PlayersTime::new(wt as u32, bt as u32, winc, binc))
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
