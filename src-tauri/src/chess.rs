use std::{
    fmt::Display,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Instant,
};

use derivative::Derivative;
use governor::{Quota, RateLimiter};
use log::{info, warn};
use nonzero_ext::*;
use serde::{Deserialize, Serialize};
use shakmaty::{
    fen::Fen, san::SanPlus, uci::UciMove, ByColor, CastlingMode, Chess, Color, EnPassantMode,
    Position, Role,
};
use specta::Type;
use tauri_specta::Event;
use tokio::sync::Mutex;
use vampirc_uci::{
    parse_one,
    uci::{Score, ScoreValue},
    UciInfoAttribute, UciMessage, UciOptionConfig,
};

use crate::{
    db::{is_position_in_db, GameQuery, PositionQueryJs},
    engine::{
        parse_fen_and_apply_moves, BaseEngine, EngineLog, EngineOption, EngineReader, GoMode,
    },
    error::Error,
    progress::update_progress,
    AppState,
};

pub struct EngineProcess {
    base: BaseEngine,
    last_depth: u32,
    best_moves: Vec<BestMoves>,
    last_best_moves: Vec<BestMoves>,
    last_progress: f32,
    options: EngineOptions,
    go_mode: GoMode,
    running: bool,
    real_multipv: u16,
    start: Instant,
}

impl EngineProcess {
    async fn new(path: PathBuf) -> Result<(Self, EngineReader), Error> {
        let mut base = BaseEngine::spawn(path).await?;
        base.init_uci().await?;
        Self::from_ready_base(base)
    }

    fn from_ready_base(mut base: BaseEngine) -> Result<(Self, EngineReader), Error> {
        let reader = base.take_reader().ok_or(Error::EngineDisconnected)?;

        Ok((
            Self {
                base,
                last_depth: 0,
                best_moves: Vec::new(),
                last_best_moves: Vec::new(),
                last_progress: 0.0,
                options: EngineOptions::default(),
                real_multipv: 0,
                go_mode: GoMode::Infinite,
                running: false,
                start: Instant::now(),
            },
            reader,
        ))
    }

    async fn set_option<T>(&mut self, name: &str, value: T) -> Result<(), Error>
    where
        T: Display,
    {
        self.base.set_option(name, value).await
    }

    async fn set_options(&mut self, options: EngineOptions) -> Result<(), Error> {
        let fen_changed = options.fen != self.options.fen;
        let fen: Fen = options.fen.parse()?;
        let setup = fen.as_setup();
        let castling_mode = CastlingMode::detect(setup);
        let pos = parse_fen_and_apply_moves(&options.fen, &options.moves)?;

        if fen_changed {
            if castling_mode.is_chess960() {
                self.set_option("UCI_Chess960", "true").await?;
            } else {
                self.set_option("UCI_Chess960", "false").await?;
            }
        }

        let multipv = options
            .extra_options
            .iter()
            .find(|x| x.name == "MultiPV")
            .map(|x| x.value.parse().unwrap_or(1))
            .unwrap_or(1);

        self.real_multipv = multipv.min(pos.legal_moves().len() as u16);

        for option in &options.extra_options {
            if !self.options.extra_options.contains(option) && option.name != "UCI_Chess960" {
                self.set_option(&option.name, &option.value).await?;
            }
        }

        if fen_changed || options.moves != self.options.moves {
            self.set_position(&options.fen, &options.moves).await?;
        }
        self.last_depth = 0;
        self.options = options.clone();
        self.best_moves.clear();
        self.last_best_moves.clear();
        self.last_progress = 0.0;
        Ok(())
    }

    async fn set_position(&mut self, fen: &str, moves: &[String]) -> Result<(), Error> {
        self.base.set_position(fen, moves).await?;
        self.options.fen = fen.to_string();
        self.options.moves = moves.to_owned();
        Ok(())
    }

    async fn go(&mut self, mode: &GoMode) -> Result<(), Error> {
        self.go_mode = mode.clone();
        self.base.go(mode).await?;
        self.running = true;
        self.start = Instant::now();
        Ok(())
    }

    async fn stop(&mut self) -> Result<(), Error> {
        self.base.stop().await?;
        self.running = false;
        Ok(())
    }

    async fn kill(&mut self) -> Result<(), Error> {
        self.base.shutdown().await?;
        self.running = false;
        Ok(())
    }

    pub fn kill_sync(&mut self) {
        self.base.kill_sync();
    }
}

#[derive(Clone, Serialize, Debug, Derivative, Type)]
#[derivative(Default)]
pub struct BestMoves {
    nodes: u32,
    depth: u32,
    score: Score,
    #[serde(rename = "uciMoves")]
    uci_moves: Vec<String>,
    #[serde(rename = "sanMoves")]
    san_moves: Vec<String>,
    #[derivative(Default(value = "1"))]
    multipv: u16,
    nps: u32,
}

#[derive(Serialize, Debug, Clone, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct BestMovesPayload {
    pub best_lines: Vec<BestMoves>,
    pub engine: String,
    pub tab: String,
    pub fen: String,
    pub moves: Vec<String>,
    pub progress: f64,
}

fn invert_score(score: Score) -> Score {
    let new_value = match score.value {
        ScoreValue::Cp(x) => ScoreValue::Cp(-x),
        ScoreValue::Mate(x) => ScoreValue::Mate(-x),
    };
    let new_wdl = score.wdl.map(|(w, d, l)| (l, d, w));
    Score {
        value: new_value,
        wdl: new_wdl,
        ..score
    }
}

fn parse_uci_attrs(
    attrs: Vec<UciInfoAttribute>,
    fen: &Fen,
    moves: &[String],
) -> Result<BestMoves, Error> {
    let mut best_moves = BestMoves::default();

    let mut pos = parse_fen_and_apply_moves(&fen.to_string(), moves)?;
    let turn = pos.turn();

    for a in attrs {
        match a {
            UciInfoAttribute::Pv(m) => {
                for mv in m {
                    let uci: UciMove = mv.to_string().parse()?;
                    let m = uci.to_move(&pos)?;
                    let san = SanPlus::from_move_and_play_unchecked(&mut pos, m);
                    best_moves.san_moves.push(san.to_string());
                    best_moves.uci_moves.push(uci.to_string());
                }
            }
            UciInfoAttribute::Nps(nps) => {
                best_moves.nps = nps as u32;
            }
            UciInfoAttribute::Nodes(nodes) => {
                best_moves.nodes = nodes as u32;
            }
            UciInfoAttribute::Depth(depth) => {
                best_moves.depth = depth;
            }
            UciInfoAttribute::MultiPv(multipv) => {
                best_moves.multipv = multipv;
            }
            UciInfoAttribute::Score(score) => {
                best_moves.score = score;
            }
            _ => (),
        }
    }

    if best_moves.san_moves.is_empty() {
        return Err(Error::NoMovesFound);
    }

    if turn == Color::Black {
        best_moves.score = invert_score(best_moves.score);
    }

    Ok(best_moves)
}

#[derive(Deserialize, Debug, Clone, Type, Derivative, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derivative(Default)]
pub struct EngineOptions {
    pub fen: String,
    pub moves: Vec<String>,
    pub extra_options: Vec<EngineOption>,
}

type EngineKey = (String, String);
type SharedEngine = Arc<Mutex<EngineProcess>>;

/// The slot is installed before spawning or awaiting UCI readiness. All requests
/// for one tab/engine share it, even while a slow neural engine loads its model.
struct EngineSession {
    update: Mutex<()>,
    process: std::sync::Mutex<Option<SharedEngine>>,
    kill_handle: std::sync::Mutex<Option<crate::engine::EngineKillHandle>>,
    cancelled: tokio::sync::watch::Sender<bool>,
}

impl Default for EngineSession {
    fn default() -> Self {
        Self {
            update: Mutex::new(()),
            process: std::sync::Mutex::new(None),
            kill_handle: std::sync::Mutex::new(None),
            cancelled: tokio::sync::watch::channel(false).0,
        }
    }
}

impl EngineSession {
    fn process(&self) -> Option<SharedEngine> {
        self.process.lock().unwrap().clone()
    }

    fn cancel(&self) {
        self.cancelled.send_replace(true);
    }

    fn is_cancelled(&self) -> bool {
        *self.cancelled.borrow()
    }

    async fn cancelled(&self) {
        let mut receiver = self.cancelled.subscribe();
        while !*receiver.borrow_and_update() {
            if receiver.changed().await.is_err() {
                break;
            }
        }
    }

    fn kill_sync(&self) {
        self.cancel();
        if let Some(handle) = self.kill_handle.lock().unwrap().as_ref() {
            handle.kill_sync();
        }
        if let Some(process) = self.process() {
            if let Ok(mut process) = process.try_lock() {
                process.kill_sync();
            }
        }
    }

    async fn shutdown(&self) -> Result<(), Error> {
        self.cancel();
        // Wait until a cancelled initializer has shut down its local process.
        let _update = self.update.lock().await;
        let process = self.process.lock().unwrap().take();
        if let Some(process) = process {
            process.lock().await.kill().await?;
        }
        Ok(())
    }

    async fn request(
        self: &Arc<Self>,
        registry: &EngineRegistry,
        key: &EngineKey,
        path: PathBuf,
        options: EngineOptions,
        go_mode: GoMode,
    ) -> Result<EngineRequest, Error> {
        let _update = self.update.lock().await;
        if self.is_cancelled() {
            return Ok(EngineRequest::Cancelled);
        }
        let mut reader = None;
        let mut startup_guard = None;
        let process = if let Some(process) = self.process() {
            process
        } else {
            startup_guard = Some(EngineReaderGuard::new(registry, key.clone(), self.clone()));
            let mut base = BaseEngine::spawn(path).await?;
            *self.kill_handle.lock().unwrap() = Some(base.kill_handle());
            let ready = tokio::select! {
                biased;
                _ = self.cancelled() => None,
                ready = base.init_uci() => Some(ready),
            };
            match ready {
                Some(Ok(())) => {}
                other => {
                    let _ = base.shutdown().await;
                    return match other {
                        Some(Err(error)) => Err(error),
                        _ => Ok(EngineRequest::Cancelled),
                    };
                }
            }
            let (process, new_reader) = EngineProcess::from_ready_base(base)?;
            reader = Some(new_reader);
            let process = Arc::new(Mutex::new(process));
            *self.process.lock().unwrap() = Some(process.clone());
            process
        };
        let update = async {
            if reader.is_none() {
                {
                    let mut process = process.lock().await;
                    if options == process.options && go_mode == process.go_mode && process.running {
                        return Ok(Some((
                            process.last_progress,
                            process.last_best_moves.clone(),
                        )));
                    }
                    process.stop().await?;
                }
                // Let the independent reader consume the previous search output.
                tokio::time::sleep(std::time::Duration::from_millis(50)).await;
            }
            let mut process = process.lock().await;
            process.set_options(options).await?;
            process.go(&go_mode).await?;
            Ok::<_, Error>(None)
        };
        let cached = tokio::select! {
            biased;
            _ = self.cancelled() => return Ok(EngineRequest::Cancelled),
            result = update => result?,
        };
        if let Some(guard) = startup_guard.as_mut() {
            guard.armed = false;
        }
        Ok(match reader {
            Some(reader) => EngineRequest::Started { reader, process },
            None => EngineRequest::Existing(cached),
        })
    }
}

enum EngineRequest {
    Started {
        reader: EngineReader,
        process: SharedEngine,
    },
    Existing(Option<(f32, Vec<BestMoves>)>),
    Cancelled,
}

#[derive(Default)]
pub struct EngineRegistry {
    sessions: dashmap::DashMap<EngineKey, Arc<EngineSession>>,
    closed_tabs: std::sync::Mutex<std::collections::HashSet<String>>,
}

impl EngineRegistry {
    fn session(&self, key: &EngineKey) -> Option<Arc<EngineSession>> {
        self.sessions.get(key).map(|entry| entry.value().clone())
    }

    async fn request(
        &self,
        key: &EngineKey,
        path: PathBuf,
        options: EngineOptions,
        go_mode: GoMode,
    ) -> Result<(Arc<EngineSession>, EngineRequest), Error> {
        let session = {
            // Closing a tab and publishing a pending startup must be ordered.
            // Tab IDs are unique; late IPC requests cannot reopen a closed tab.
            let closed_tabs = self.closed_tabs.lock().unwrap();
            if closed_tabs.iter().any(|tab| key.0.starts_with(tab)) {
                let session = Arc::new(EngineSession::default());
                session.cancel();
                return Ok((session, EngineRequest::Cancelled));
            }
            self.sessions.entry(key.clone()).or_default().clone()
        };
        let result = session.request(self, key, path, options, go_mode).await;
        if result.is_err() {
            self.remove_session(key, &session);
            let _ = session.shutdown().await;
        }
        result.map(|result| (session, result))
    }

    fn remove_session(&self, key: &EngineKey, session: &Arc<EngineSession>) {
        session.cancel();
        self.sessions
            .remove_if(key, |_, current| Arc::ptr_eq(current, session));
    }

    async fn release(&self, key: &EngineKey) -> Result<(), Error> {
        if let Some((_, session)) = self.sessions.remove(key) {
            session.shutdown().await?;
        }
        Ok(())
    }

    async fn release_tab(&self, tab: &str) -> Result<(), Error> {
        self.closed_tabs.lock().unwrap().insert(tab.to_owned());
        let sessions: Vec<_> = self
            .sessions
            .iter()
            .filter(|entry| entry.key().0.starts_with(tab))
            .map(|entry| (entry.key().clone(), entry.value().clone()))
            .collect();
        // Cancel every pending initializer before waiting for any shutdown.
        for (key, session) in &sessions {
            self.remove_session(key, session);
        }
        let mut failure = None;
        for (_, session) in sessions {
            if let Err(error) = session.shutdown().await {
                failure = Some(error);
            }
        }
        failure.map_or(Ok(()), Err)
    }

    async fn stop(&self, key: &EngineKey) -> Result<(), Error> {
        if let Some(session) = self.session(key) {
            if let Some(process) = session.process() {
                let _update = session.update.lock().await;
                if !session.is_cancelled() {
                    process.lock().await.stop().await?;
                }
            } else {
                // A disabled engine must not finish loading and start searching.
                self.remove_session(key, &session);
                session.shutdown().await?;
            }
        }
        Ok(())
    }

    pub fn kill_all_sync(&self) {
        for entry in self.sessions.iter() {
            entry.value().kill_sync();
        }
    }
}

/// EOF, reader errors and cancelled IPC futures may only retire their own
/// generation, never a replacement created by a later request.
struct EngineReaderGuard<'a> {
    registry: &'a EngineRegistry,
    key: EngineKey,
    session: Arc<EngineSession>,
    armed: bool,
}

impl<'a> EngineReaderGuard<'a> {
    fn new(registry: &'a EngineRegistry, key: EngineKey, session: Arc<EngineSession>) -> Self {
        Self {
            registry,
            key,
            session,
            armed: true,
        }
    }
}

impl Drop for EngineReaderGuard<'_> {
    fn drop(&mut self) {
        if !self.armed {
            return;
        }
        self.registry.remove_session(&self.key, &self.session);
        self.session.kill_sync();
    }
}

#[tauri::command]
#[specta::specta]
pub async fn kill_engines(tab: String, state: tauri::State<'_, AppState>) -> Result<(), Error> {
    state.engine_processes.release_tab(&tab).await
}

#[tauri::command]
#[specta::specta]
pub async fn kill_engine(
    engine: String,
    tab: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    state.engine_processes.release(&(tab, engine)).await
}

#[tauri::command]
#[specta::specta]
pub async fn stop_engine(
    engine: String,
    tab: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    state.engine_processes.stop(&(tab, engine)).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_engine_logs(
    engine: String,
    tab: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<EngineLog>, Error> {
    if let Some(process) = state
        .engine_processes
        .session(&(tab, engine))
        .and_then(|s| s.process())
    {
        return Ok(process.lock().await.base.get_logs());
    }
    Ok(Vec::new())
}

#[tauri::command]
#[specta::specta]
pub async fn get_best_moves(
    id: String,
    engine: String,
    tab: String,
    go_mode: GoMode,
    options: EngineOptions,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Option<(f32, Vec<BestMoves>)>, Error> {
    let path = PathBuf::from(&engine);

    let key = (tab.clone(), id.clone());

    if let Err(error) = parse_fen_and_apply_moves(&options.fen, &options.moves) {
        warn!("Invalid position for engine: {:?}", error);
        state.engine_processes.stop(&key).await?;
        return Ok(None);
    }
    let (session, request) = state
        .engine_processes
        .request(&key, path, options, go_mode)
        .await?;
    let (mut reader, process) = match request {
        EngineRequest::Started { reader, process } => (reader, process),
        EngineRequest::Existing(cached) => return Ok(cached),
        EngineRequest::Cancelled => return Ok(None),
    };
    let _reader_guard = EngineReaderGuard::new(&state.engine_processes, key, session.clone());

    let lim = RateLimiter::direct(Quota::per_second(nonzero!(5u32)));

    loop {
        let line = tokio::select! {
            biased;
            _ = session.cancelled() => break,
            line = reader.next_line() => match line? {
                Some(line) => line,
                None => break,
            },
        };
        let mut proc = process.lock().await;
        if session.is_cancelled() {
            break;
        }
        match parse_one(&line) {
            UciMessage::Info(attrs) => {
                match parse_uci_attrs(attrs, &proc.options.fen.parse()?, &proc.options.moves) {
                    Ok(best_moves) => {
                        if best_moves.score.lower_bound == Some(true)
                            || best_moves.score.upper_bound == Some(true)
                        {
                            continue;
                        }
                        let multipv = best_moves.multipv;
                        let cur_depth = best_moves.depth;
                        let cur_nodes = best_moves.nodes;
                        if multipv as usize == proc.best_moves.len() + 1 {
                            proc.best_moves.push(best_moves);
                            if multipv == proc.real_multipv {
                                if proc.best_moves.iter().all(|x| x.depth == cur_depth)
                                    && cur_depth >= proc.last_depth
                                {
                                    let progress = match proc.go_mode {
                                        GoMode::Depth(depth) => {
                                            (cur_depth as f64 / depth as f64) * 100.0
                                        }
                                        GoMode::Time(time) => {
                                            (proc.start.elapsed().as_millis() as f64 / time as f64)
                                                * 100.0
                                        }
                                        GoMode::Nodes(nodes) => {
                                            (cur_nodes as f64 / nodes as f64) * 100.0
                                        }
                                        GoMode::PlayersTime(_) => 99.99,
                                        GoMode::Infinite => 99.99,
                                    };
                                    proc.last_depth = cur_depth;
                                    proc.last_best_moves = proc.best_moves.clone();
                                    proc.last_progress = progress as f32;
                                    if lim.check().is_ok() {
                                        BestMovesPayload {
                                            best_lines: proc.best_moves.clone(),
                                            engine: id.clone(),
                                            tab: tab.clone(),
                                            fen: proc.options.fen.clone(),
                                            moves: proc.options.moves.clone(),
                                            progress,
                                        }
                                        .emit(&app)?;
                                    }
                                }
                                proc.best_moves.clear();
                            }
                        }
                    }
                    Err(e) => match e {
                        Error::NoMovesFound => {}
                        _ => {
                            warn!("Failed to parse info line: {}, error: {:?}", line, e);
                        }
                    },
                }
            }
            UciMessage::BestMove { .. } => {
                BestMovesPayload {
                    best_lines: proc.last_best_moves.clone(),
                    engine: id.clone(),
                    tab: tab.clone(),
                    fen: proc.options.fen.clone(),
                    moves: proc.options.moves.clone(),
                    progress: 100.0,
                }
                .emit(&app)?;
                proc.last_progress = 100.0;
                proc.running = false;
            }
            _ => {}
        }
        proc.base.log_engine(&line);
    }
    info!("Engine process finished: tab: {}, engine: {}", tab, engine);
    Ok(None)
}

#[derive(Serialize, Debug, Default, Type)]
pub struct MoveAnalysis {
    best: Vec<BestMoves>,
    novelty: bool,
    is_sacrifice: bool,
}

#[derive(Deserialize, Debug, Default, Type)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisOptions {
    pub fen: String,
    pub moves: Vec<String>,
    pub annotate_novelties: bool,
    pub reference_db: Option<PathBuf>,
    pub reversed: bool,
}

#[tauri::command]
#[specta::specta]
pub async fn cancel_analysis(id: String, state: tauri::State<'_, AppState>) -> Result<(), Error> {
    if let Some(flag) = state.analysis_cancel_flags.get(&id) {
        flag.store(true, Ordering::SeqCst);
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn analyze_game(
    id: String,
    engine: String,
    go_mode: GoMode,
    options: AnalysisOptions,
    uci_options: Vec<EngineOption>,
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<Vec<MoveAnalysis>, Error> {
    let cancel_flag = Arc::new(AtomicBool::new(false));
    state
        .analysis_cancel_flags
        .insert(id.clone(), cancel_flag.clone());

    let path = PathBuf::from(&engine);
    let mut analysis: Vec<MoveAnalysis> = Vec::new();

    let (mut proc, mut reader) = EngineProcess::new(path).await?;

    let fen = Fen::from_ascii(options.fen.as_bytes())?;
    let setup = fen.as_setup().clone();
    let castling_mode = CastlingMode::detect(&setup);

    let mut chess: Chess = setup.position(castling_mode)?;
    let mut fens: Vec<(Fen, Vec<String>, bool)> = vec![(fen, vec![], false)];

    options
        .moves
        .iter()
        .enumerate()
        .try_for_each(|(i, m)| -> Result<(), Error> {
            let uci = UciMove::from_ascii(m.as_bytes())?;
            let m = uci.to_move(&chess)?;
            let previous_pos = chess.clone();
            chess.play_unchecked(m);
            let current_pos = chess.clone();
            if !chess.is_game_over() {
                let prev_eval = naive_eval(&previous_pos);
                let cur_eval = -naive_eval(&current_pos);
                fens.push((
                    Fen::from_position(&current_pos, EnPassantMode::Legal),
                    options.moves.clone().into_iter().take(i + 1).collect(),
                    prev_eval > cur_eval + 100,
                ));
            }
            Ok(())
        })?;

    if options.reversed {
        fens.reverse();
    }

    let mut novelty_found = false;

    for (i, (_, moves, _)) in fens.iter().enumerate() {
        if cancel_flag.load(Ordering::SeqCst) {
            proc.kill().await?;
            state.analysis_cancel_flags.remove(&id);
            return Err(Error::AnalysisCancelled);
        }

        update_progress(
            &state.progress_state,
            &app,
            id.clone(),
            (i as f32 / fens.len() as f32) * 100.0,
            false,
        )?;

        let mut extra_options = uci_options.clone();
        if !extra_options.iter().any(|x| x.name == "MultiPV") {
            extra_options.push(EngineOption {
                name: "MultiPV".to_string(),
                value: "2".to_string(),
            });
        } else {
            extra_options.iter_mut().for_each(|x| {
                if x.name == "MultiPV" {
                    x.value = "2".to_string();
                }
            });
        }

        proc.set_options(EngineOptions {
            fen: options.fen.clone(),
            moves: moves.clone(),
            extra_options,
        })
        .await?;

        proc.go(&go_mode).await?;

        let mut current_analysis = MoveAnalysis::default();
        while let Ok(Some(line)) = reader.next_line().await {
            match parse_one(&line) {
                UciMessage::Info(attrs) => {
                    if let Ok(best_moves) =
                        parse_uci_attrs(attrs, &proc.options.fen.parse()?, moves)
                    {
                        let multipv = best_moves.multipv;
                        let cur_depth = best_moves.depth;
                        if multipv as usize == proc.best_moves.len() + 1 {
                            proc.best_moves.push(best_moves);
                            if multipv == proc.real_multipv {
                                if proc.best_moves.iter().all(|x| x.depth == cur_depth)
                                    && cur_depth >= proc.last_depth
                                {
                                    current_analysis.best = proc.best_moves.clone();
                                    proc.last_depth = cur_depth;
                                }
                                assert_eq!(proc.best_moves.len(), proc.real_multipv as usize);
                                proc.best_moves.clear();
                            }
                        }
                    }
                }
                UciMessage::BestMove { .. } => {
                    break;
                }
                _ => {}
            }
        }
        analysis.push(current_analysis);
    }

    if options.reversed {
        analysis.reverse();
        fens.reverse();
    }

    for (i, analysis) in analysis.iter_mut().enumerate() {
        let fen = &fens[i].0;
        // let query = PositionQuery::exact_from_fen(&fen.to_string())?;
        let query = PositionQueryJs {
            fen: fen.to_string(),
            type_: "exact".to_string(),
        };

        analysis.is_sacrifice = fens[i].2;
        if options.annotate_novelties && !novelty_found {
            if let Some(reference) = options.reference_db.clone() {
                analysis.novelty = !is_position_in_db(
                    reference,
                    GameQuery::new().position(query.clone()).clone(),
                    state.clone(),
                )
                .await?;
                if analysis.novelty {
                    novelty_found = true;
                }
            } else {
                return Err(Error::MissingReferenceDatabase);
            }
        }
    }
    update_progress(&state.progress_state, &app, id.clone(), 100.0, true)?;
    state.analysis_cancel_flags.remove(&id);
    Ok(analysis)
}

fn count_material(position: &Chess) -> i32 {
    if position.is_checkmate() {
        return -10000;
    }
    let material: ByColor<i32> = position.board().material().map(|p| {
        p.pawn as i32 * piece_value(Role::Pawn)
            + p.knight as i32 * piece_value(Role::Knight)
            + p.bishop as i32 * piece_value(Role::Bishop)
            + p.rook as i32 * piece_value(Role::Rook)
            + p.queen as i32 * piece_value(Role::Queen)
    });
    if position.turn() == Color::White {
        material.white - material.black
    } else {
        material.black - material.white
    }
}

fn piece_value(role: Role) -> i32 {
    match role {
        Role::Pawn => 90,
        Role::Knight => 300,
        Role::Bishop => 300,
        Role::Rook => 500,
        Role::Queen => 1000,
        _ => 0,
    }
}

fn qsearch(position: &Chess, mut alpha: i32, beta: i32) -> i32 {
    let stand_pat = count_material(position);

    if stand_pat >= beta {
        return beta;
    }
    if alpha < stand_pat {
        alpha = stand_pat;
    }
    let legal_moves = position.legal_moves();
    let mut captures: Vec<_> = legal_moves.iter().filter(|m| m.is_capture()).collect();

    captures.sort_by(|a, b| {
        let a_value = piece_value(a.capture().unwrap());
        let b_value = piece_value(b.capture().unwrap());
        b_value.cmp(&a_value)
    });

    for capture in captures {
        let mut new_position = position.clone();
        new_position.play_unchecked(*capture);
        let score = -qsearch(&new_position, -beta, -alpha);
        if score >= beta {
            return beta;
        }
        if score > alpha {
            alpha = score;
        }
    }

    alpha
}

fn naive_eval(pos: &Chess) -> i32 {
    pos.legal_moves()
        .iter()
        .map(|mv| {
            let mut new_position = pos.clone();
            new_position.play_unchecked(*mv);
            -qsearch(&new_position, i32::MIN, i32::MAX)
        })
        .max()
        .unwrap_or(i32::MIN)
}

#[cfg(test)]
mod tests {
    use shakmaty::FromSetup;

    use super::*;

    fn pos(fen: &str) -> Chess {
        let fen: Fen = fen.parse().unwrap();
        Chess::from_setup(fen.into_setup(), CastlingMode::Chess960).unwrap()
    }

    #[test]
    fn eval_start_pos() {
        assert_eq!(naive_eval(&Chess::default()), 0);
    }

    #[test]
    fn eval_scandi() {
        let position = pos("rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2");
        assert_eq!(naive_eval(&position), 0);
    }

    #[test]
    fn eval_hanging_pawn() {
        let position = pos("r1bqkbnr/ppp1pppp/2n5/1B1p4/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3");
        assert_eq!(naive_eval(&position), 90);
    }

    #[test]
    fn eval_complex_center() {
        let position = pos("r1bqkbnr/ppp2ppp/2n5/1B1pp3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4");
        assert_eq!(naive_eval(&position), 90);
    }

    #[test]
    fn eval_in_check() {
        let position = pos("r1bqkbnr/ppp2ppp/2B5/3pp3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 4");
        assert_eq!(naive_eval(&position), -90);
    }

    #[test]
    fn eval_rook_stack() {
        let position = pos("rnrq4/8/8/1R6/1R6/1R5K/1Q6/7k w - - 0 1");
        assert_eq!(naive_eval(&position), 10000);
    }

    #[test]
    fn eval_rook_stack2() {
        let position = pos("rnrq4/8/8/1R6/1Q6/1R5K/1R6/7k w - - 0 1");
        assert_eq!(naive_eval(&position), 10000);
    }

    #[test]
    fn eval_opera_game1() {
        let position = pos("4kb1r/p2rqppp/5n2/1B2p1B1/4P3/1Q6/PPP2PPP/2K4R w k - 0 14");
        assert_eq!(naive_eval(&position), -120);
    }

    #[test]
    fn eval_opera_game2() {
        let position = pos("4kb1r/p2rqppp/5n2/1B2p1B1/4P3/1Q6/PPP2PPP/2KR4 b k - 1 14");
        assert_eq!(naive_eval(&position), 20);
    }
}

#[derive(Type, Default, Serialize, Debug)]
pub struct EngineConfig {
    pub name: String,
    pub options: Vec<UciOptionConfig>,
}

#[tauri::command]
#[specta::specta]
pub async fn get_engine_config(path: PathBuf) -> Result<EngineConfig, Error> {
    let mut base = BaseEngine::spawn(path).await?;

    base.send("uci").await?;

    let mut config = EngineConfig::default();

    let reader = base.reader_mut().ok_or(Error::EngineDisconnected)?;
    while let Some(line) = reader.next_line().await? {
        if let UciMessage::Id {
            name: Some(name),
            author: _,
        } = parse_one(&line)
        {
            config.name = name;
        }
        if let UciMessage::Option(opt) = parse_one(&line) {
            config.options.push(opt);
        }
        if let UciMessage::UciOk = parse_one(&line) {
            break;
        }
    }
    println!("{:?}", config);
    base.quit().await?;
    Ok(config)
}

#[cfg(all(test, unix))]
#[path = "chess_lifecycle_tests.rs"]
mod lifecycle_tests;
