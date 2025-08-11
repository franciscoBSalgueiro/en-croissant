use std::{fmt::Display, path::PathBuf, process::Stdio, sync::Arc, time::Instant};

use diesel::connection::SimpleConnection;
use tauri::Manager;

use derivative::Derivative;
use governor::{Quota, RateLimiter};
use log::{error, info};
use nonzero_ext::*;
use serde::{Deserialize, Serialize};
use shakmaty::{
    fen::Fen, san::SanPlus, uci::UciMove, ByColor, CastlingMode, Chess, Color, EnPassantMode,
    Position, Role,
};
use specta::Type;
use tauri_specta::Event;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader, Lines},
    process::{Child, ChildStdin, ChildStdout, Command},
    sync::Mutex,
};
use vampirc_uci::{
    parse_one,
    uci::{Score, ScoreValue},
    UciInfoAttribute, UciMessage, UciOptionConfig,
};

use crate::{
    db::{is_position_in_db, GameQueryJs, PositionQueryJs},
    error::Error,
    AppState,
};

// Serializable wrapper for ScoreValue
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SerializableScoreValue {
    Cp(i32),
    Mate(i32),
}

impl From<ScoreValue> for SerializableScoreValue {
    fn from(value: ScoreValue) -> Self {
        match value {
            ScoreValue::Cp(cp) => SerializableScoreValue::Cp(cp),
            ScoreValue::Mate(mate) => SerializableScoreValue::Mate(mate),
        }
    }
}

impl From<SerializableScoreValue> for ScoreValue {
    fn from(value: SerializableScoreValue) -> Self {
        match value {
            SerializableScoreValue::Cp(cp) => ScoreValue::Cp(cp),
            SerializableScoreValue::Mate(mate) => ScoreValue::Mate(mate),
        }
    }
}

// Serializable wrapper for Score
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerializableScore {
    pub value: SerializableScoreValue,
    pub wdl: Option<(i32, i32, i32)>,
    pub lower_bound: Option<bool>,
    pub upper_bound: Option<bool>,
}

impl From<Score> for SerializableScore {
    fn from(score: Score) -> Self {
        Self {
            value: score.value.into(),
            wdl: score.wdl,
            lower_bound: score.lower_bound,
            upper_bound: score.upper_bound,
        }
    }
}

impl From<SerializableScore> for Score {
    fn from(score: SerializableScore) -> Self {
        Self {
            value: score.value.into(),
            wdl: score.wdl,
            lower_bound: score.lower_bound,
            upper_bound: score.upper_bound,
        }
    }
}

// Cache-related structures
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct EngineCacheKey {
    pub fen: String,
    pub moves: Vec<String>,
    pub engine_path: String,
    pub engine_options: Vec<EngineOption>,
    pub go_mode: GoMode,
}

impl EngineCacheKey {
    pub fn to_hash_string(&self) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        self.hash(&mut hasher);
        format!("{:x}", hasher.finish())
    }
}

// Serializable version of BestMoves for caching
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerializableBestMoves {
    pub nodes: u32,
    pub depth: u32,
    pub score: SerializableScore,
    pub uci_moves: Vec<String>,
    pub san_moves: Vec<String>,
    pub multipv: u16,
    pub nps: u32,
}

impl From<BestMoves> for SerializableBestMoves {
    fn from(bm: BestMoves) -> Self {
        Self {
            nodes: bm.nodes,
            depth: bm.depth,
            score: bm.score.into(),
            uci_moves: bm.uci_moves,
            san_moves: bm.san_moves,
            multipv: bm.multipv,
            nps: bm.nps,
        }
    }
}

impl From<SerializableBestMoves> for BestMoves {
    fn from(sbm: SerializableBestMoves) -> Self {
        Self {
            nodes: sbm.nodes,
            depth: sbm.depth,
            score: sbm.score.into(),
            uci_moves: sbm.uci_moves,
            san_moves: sbm.san_moves,
            multipv: sbm.multipv,
            nps: sbm.nps,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedAnalysisResult {
    pub best_moves: Vec<SerializableBestMoves>,
    pub depth: u32,
    pub nodes: u32,
    pub created_at: i64,
    pub last_accessed: i64,
}

impl CachedAnalysisResult {
    pub fn new(best_moves: Vec<BestMoves>) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        
        let depth = best_moves.iter().map(|bm| bm.depth).max().unwrap_or(0);
        let nodes = best_moves.iter().map(|bm| bm.nodes).max().unwrap_or(0);
        let serializable_moves: Vec<SerializableBestMoves> = best_moves.into_iter().map(|bm| bm.into()).collect();
        
        Self {
            best_moves: serializable_moves,
            depth,
            nodes,
            created_at: now,
            last_accessed: now,
        }
    }
    
    pub fn to_best_moves(&self) -> Vec<BestMoves> {
        self.best_moves.iter().cloned().map(|sbm| sbm.into()).collect()
    }
    
    pub fn touch(&mut self) {
        self.last_accessed = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
    }
}

#[derive(Debug, Clone, Serialize, Type)]
#[serde(tag = "type", content = "value", rename_all = "camelCase")]
pub enum EngineLog {
    Gui(String),
    Engine(String),
}

#[derive(Debug)]
pub struct EngineProcess {
    stdin: ChildStdin,
    last_depth: u32,
    best_moves: Vec<BestMoves>,
    last_best_moves: Vec<BestMoves>,
    last_progress: f32,
    options: EngineOptions,
    go_mode: GoMode,
    running: bool,
    real_multipv: u16,
    logs: Vec<EngineLog>,
    start: Instant,
}

impl EngineProcess {
    async fn new(path: PathBuf) -> Result<(Self, Lines<BufReader<ChildStdout>>), Error> {
        let mut command = Command::new(&path);
        command.current_dir(path.parent().unwrap());
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(target_os = "windows")]
        command.creation_flags(CREATE_NO_WINDOW);

        let mut child = command.spawn()?;

        let mut logs = Vec::new();

        let mut stdin = child.stdin.take().ok_or(Error::NoStdin)?;

        tokio::spawn(async move {
            let mut stderr = BufReader::new(child.stderr.take().unwrap()).lines();
            while let Some(line) = stderr.next_line().await.unwrap() {
                error!("{}", &line);
            }
        });

        let mut lines = BufReader::new(child.stdout.take().ok_or(Error::NoStdout)?).lines();

        let _ = stdin.write_all("uci\n".as_bytes()).await;
        logs.push(EngineLog::Gui("uci\n".to_string()));
        while let Some(line) = lines.next_line().await? {
            logs.push(EngineLog::Engine(line.clone()));
            if line == "uciok" {
                let _ = stdin.write_all("isready\n".as_bytes()).await;
                logs.push(EngineLog::Gui("isready\n".to_string()));
                while let Some(line_is_ready) = lines.next_line().await? {
                    logs.push(EngineLog::Engine(line_is_ready.clone()));
                    if line_is_ready == "readyok" {
                        break;
                    }
                }
                break;
            }
        }

        Ok((
            Self {
                stdin,
                last_depth: 0,
                best_moves: Vec::new(),
                last_best_moves: Vec::new(),
                last_progress: 0.0,
                logs,
                options: EngineOptions::default(),
                real_multipv: 0,
                go_mode: GoMode::Infinite,
                running: false,
                start: Instant::now(),
            },
            lines,
        ))
    }

    async fn set_option<T>(&mut self, name: &str, value: T) -> Result<(), Error>
    where
        T: Display,
    {
        let msg = format!("setoption name {} value {}\n", name, value);
        self.stdin.write_all(msg.as_bytes()).await?;
        self.logs.push(EngineLog::Gui(msg));

        Ok(())
    }

    async fn set_options(&mut self, options: EngineOptions) -> Result<(), Error> {
        let fen: Fen = options.fen.parse()?;
        let mut pos: Chess = match fen.into_position(CastlingMode::Chess960) {
            Ok(p) => p,
            Err(e) => e.ignore_too_much_material()?,
        };
        for m in &options.moves {
            let uci = UciMove::from_ascii(m.as_bytes())?;
            let mv = uci.to_move(&pos)?;
            pos.play_unchecked(&mv);
        }
        let multipv = options
            .extra_options
            .iter()
            .find(|x| x.name == "MultiPV")
            .map(|x| x.value.parse().unwrap_or(1))
            .unwrap_or(1);

        self.real_multipv = multipv.min(pos.legal_moves().len() as u16);

        for option in &options.extra_options {
            if !self.options.extra_options.contains(option) {
                self.set_option(&option.name, &option.value).await?;
            }
        }

        if options.fen != self.options.fen || options.moves != self.options.moves {
            self.set_position(&options.fen, &options.moves).await?;
        }
        self.last_depth = 0;
        self.options = options.clone();
        self.best_moves.clear();
        self.last_best_moves.clear();
        Ok(())
    }

    async fn set_position(&mut self, fen: &str, moves: &Vec<String>) -> Result<(), Error> {
        let msg = if moves.is_empty() {
            format!("position fen {}\n", fen)
        } else {
            format!("position fen {} moves {}\n", fen, moves.join(" "))
        };

        self.stdin.write_all(msg.as_bytes()).await?;
        self.options.fen = fen.to_string();
        self.options.moves = moves.clone();
        self.logs.push(EngineLog::Gui(msg));
        Ok(())
    }

    async fn go(&mut self, mode: &GoMode) -> Result<(), Error> {
        self.go_mode = mode.clone();
        let msg = match mode {
            GoMode::Depth(depth) => format!("go depth {}\n", depth),
            GoMode::Time(time) => format!("go movetime {}\n", time),
            GoMode::Nodes(nodes) => format!("go nodes {}\n", nodes),
            GoMode::PlayersTime(PlayersTime {
                white,
                black,
                winc,
                binc,
            }) => {
                format!(
                    "go wtime {} btime {} winc {} binc {}\n",
                    white, black, winc, binc
                )
            }
            GoMode::Infinite => "go infinite\n".to_string(),
            GoMode::SearchMoves { mode, moves } => {
                let mode_str = match **mode {
                    GoMode::Depth(depth) => format!("depth {}", depth),
                    GoMode::Time(time) => format!("movetime {}", time),
                    GoMode::Nodes(nodes) => format!("nodes {}", nodes),
                    GoMode::PlayersTime(PlayersTime {
                        white,
                        black,
                        winc,
                        binc,
                    }) => {
                        format!(
                            "wtime {} btime {} winc {} binc {}",
                            white, black, winc, binc
                        )
                    }
                    GoMode::Infinite => "infinite".to_string(),
                    GoMode::SearchMoves { .. } => {
                        return Err(Error::InvalidGoMode);
                    }
                };
                format!("go {} searchmoves {}\n", mode_str, moves.join(" "))
            }
        };
        info!("Sending UCI command: {}", msg);
        self.stdin.write_all(msg.as_bytes()).await?;
        self.logs.push(EngineLog::Gui(msg));
        self.running = true;
        self.start = Instant::now();
        Ok(())
    }

    async fn stop(&mut self) -> Result<(), Error> {
        self.stdin.write_all(b"stop\n").await?;
        self.logs.push(EngineLog::Gui("stop\n".to_string()));
        self.running = false;
        Ok(())
    }

    async fn kill(&mut self) -> Result<(), Error> {
        self.stdin.write_all(b"quit\n").await?;
        self.logs.push(EngineLog::Gui("quit\n".to_string()));
        self.running = false;
        Ok(())
    }
}

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct AnalysisCacheKey {
    pub tab: String,
    pub fen: String,
    pub engine: String,
    pub multipv: u16,
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
    moves: &Vec<String>,
) -> Result<BestMoves, Error> {
    let mut best_moves = BestMoves::default();

    let mut pos: Chess = match fen.clone().into_position(CastlingMode::Chess960) {
        Ok(p) => p,
        Err(e) => e.ignore_too_much_material()?,
    };
    for m in moves {
        let uci = UciMove::from_ascii(m.as_bytes())?;
        let mv = uci.to_move(&pos)?;
        pos.play_unchecked(&mv);
    }
    let turn = pos.turn();

    for a in attrs {
        match a {
            UciInfoAttribute::Pv(m) => {
                for mv in m {
                    let uci: UciMove = mv.to_string().parse()?;
                    let m = uci.to_move(&pos)?;
                    let san = SanPlus::from_move_and_play_unchecked(&mut pos, &m);
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

fn start_engine(path: PathBuf) -> Result<Child, Error> {
    let mut command = Command::new(&path);
    command.current_dir(path.parent().unwrap());
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    let child = command.spawn()?;

    Ok(child)
}

fn get_handles(child: &mut Child) -> Result<(ChildStdin, Lines<BufReader<ChildStdout>>), Error> {
    let stdin = child.stdin.take().ok_or(Error::NoStdin)?;
    let stdout = child.stdout.take().ok_or(Error::NoStdout)?;
    let stdout = BufReader::new(stdout).lines();
    Ok((stdin, stdout))
}

async fn send_command(stdin: &mut ChildStdin, command: impl AsRef<str>) {
    stdin
        .write_all(command.as_ref().as_bytes())
        .await
        .expect("Failed to write command");
}

#[derive(Deserialize, Debug, Clone, Type, Derivative, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derivative(Default)]
pub struct EngineOptions {
    pub fen: String,
    pub moves: Vec<String>,
    pub extra_options: Vec<EngineOption>,
    #[derivative(Default(value = "false"))]
    pub use_cache: bool,
}

#[derive(Deserialize, Serialize, Debug, Clone, Type, PartialEq, Eq, Hash)]
pub struct EngineOption {
    name: String,
    value: String,
}

#[derive(Deserialize, Serialize, Debug, Clone, Type, PartialEq, Eq, Hash)]
#[serde(tag = "t", content = "c")]
pub enum GoMode {
    PlayersTime(PlayersTime),
    Depth(u32),
    Time(u32),
    Nodes(u32),
    Infinite,
    SearchMoves {
        mode: Box<GoMode>,
        moves: Vec<String>,
    },
}

#[derive(Deserialize, Serialize, Debug, Clone, Type, PartialEq, Eq, Hash)]
pub struct PlayersTime {
    white: u32,
    black: u32,
    winc: u32,
    binc: u32,
}

#[tauri::command]
#[specta::specta]
pub async fn kill_engines(tab: String, state: tauri::State<'_, AppState>) -> Result<(), Error> {
    let keys: Vec<_> = state
        .engine_processes
        .iter()
        .map(|x| x.key().clone())
        .collect();
    for key in keys.clone() {
        if key.0.starts_with(&tab) {
            {
                let process = state.engine_processes.get_mut(&key).unwrap();
                let mut process = process.lock().await;
                process.kill().await?;
            }
            state.engine_processes.remove(&key);
        }
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn kill_engine(
    engine: String,
    tab: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let key = (tab, engine);
    if let Some(process) = state.engine_processes.get(&key) {
        let mut process = process.lock().await;
        process.kill().await?;
    }
    Ok(())
}
#[tauri::command]
#[specta::specta]
pub async fn stop_engine(
    engine: String,
    tab: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let key = (tab, engine);
    if let Some(process) = state.engine_processes.get(&key) {
        let mut process = process.lock().await;
        process.stop().await?;
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn get_engine_logs(
    engine: String,
    tab: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<EngineLog>, Error> {
    let key = (tab, engine);
    if let Some(process) = state.engine_processes.get(&key) {
        let process = process.lock().await;
        Ok(process.logs.clone())
    } else {
        Ok(Vec::new())
    }
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

    // Create cache key for this analysis request
    let cache_key = EngineCacheKey {
        fen: options.fen.clone(),
        moves: options.moves.clone(),
        engine_path: engine.clone(),
        engine_options: options.extra_options.clone(),
        go_mode: go_mode.clone(),
    };

    // Check cache first for completed analysis (but only for non-infinite modes and if cache is enabled)
    if options.use_cache && !matches!(go_mode, GoMode::Infinite) {
        if let Ok(Some(cached_result)) = get_cached_analysis(&cache_key, &app).await {
            info!("Cache hit for engine analysis: {}", cache_key.to_hash_string());
            return Ok(Some((100.0, cached_result.to_best_moves())));
        }
    }

    let key = (tab.clone(), engine.clone());

    if state.engine_processes.contains_key(&key) {
        {
            let process = state.engine_processes.get_mut(&key).unwrap();
            let mut process = process.lock().await;
            if options == process.options && go_mode == process.go_mode && process.running {
                return Ok(Some((
                    process.last_progress,
                    process.last_best_moves.clone(),
                )));
            }
            process.stop().await?;
        }
        // give time for engine to stop and process previous lines
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        {
            let process = state.engine_processes.get_mut(&key).unwrap();
            let mut process = process.lock().await;
            process.set_options(options.clone()).await?;
            process.go(&go_mode).await?;
        }
        return Ok(None);
    }

    let (mut process, mut reader) = EngineProcess::new(path).await?;
    process.set_options(options.clone()).await?;
    process.go(&go_mode).await?;

    let process = Arc::new(Mutex::new(process));

    state.engine_processes.insert(key.clone(), process.clone());

    let lim = RateLimiter::direct(Quota::per_second(nonzero!(5u32)));

    while let Some(line) = reader.next_line().await? {
        let mut proc = process.lock().await;
        match parse_one(&line) {
            UciMessage::Info(attrs) => {
                if let Ok(best_moves) =
                    parse_uci_attrs(attrs, &proc.options.fen.parse()?, &proc.options.moves)
                {
                    let multipv = best_moves.multipv;
                    let cur_depth = best_moves.depth;
                    let cur_nodes = best_moves.nodes;
                    if multipv as usize == proc.best_moves.len() + 1 {
                        proc.best_moves.push(best_moves);
                        if multipv == proc.real_multipv {
                            if proc.best_moves.iter().all(|x| x.depth == cur_depth)
                                && cur_depth >= proc.last_depth
                                && lim.check().is_ok()
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
                                    GoMode::SearchMoves { .. } => 99.99,
                                };
                                BestMovesPayload {
                                    best_lines: proc.best_moves.clone(),
                                    engine: id.clone(),
                                    tab: tab.clone(),
                                    fen: proc.options.fen.clone(),
                                    moves: proc.options.moves.clone(),
                                    progress,
                                }
                                .emit(&app)?;
                                proc.last_depth = cur_depth;
                                proc.last_best_moves = proc.best_moves.clone();
                                proc.last_progress = progress as f32;
                            }
                            proc.best_moves.clear();
                        }
                    }
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
                
                // Store completed analysis in cache (but not for infinite mode and only if cache is enabled)
                if options.use_cache && !matches!(go_mode, GoMode::Infinite) && !proc.last_best_moves.is_empty() {
                    let cached_result = CachedAnalysisResult::new(proc.last_best_moves.clone());
                    if let Err(e) = store_analysis_in_cache(&cache_key, &cached_result, &app).await {
                        info!("Failed to store analysis in cache: {:?}", e);
                    } else {
                        info!("Stored analysis in cache: {}", cache_key.to_hash_string());
                        
                        // Cleanup old entries to prevent cache from growing too large
                        if let Err(e) = cleanup_old_cache_entries(&app, 10000).await {
                            info!("Failed to cleanup old cache entries: {:?}", e);
                        }
                    }
                }
            }
            _ => {}
        }
        proc.logs.push(EngineLog::Engine(line));
    }
    info!("Engine process finished: tab: {}, engine: {}", tab, engine);
    state.engine_processes.remove(&key);
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

#[derive(Clone, Type, serde::Serialize, Event)]
pub struct ReportProgress {
    pub progress: f64,
    pub id: String,
    pub finished: bool,
}

#[derive(Serialize, Debug, Clone, Type)]
pub struct MoveScore {
    pub uci: String,
    pub score: Score,
}

#[tauri::command]
#[specta::specta]
pub async fn score_all_moves(
    engine: String,
    go_mode: GoMode,
    options: EngineOptions,
    app: tauri::AppHandle,
) -> Result<Vec<MoveScore>, Error> {
    use std::collections::HashMap;

    // Determine legal move count from the provided position first
    let fen: Fen = options.fen.parse()?;
    let mut pos: Chess = match fen.clone().into_position(CastlingMode::Chess960) {
        Ok(p) => p,
        Err(e) => e.ignore_too_much_material()?,
    };
    for m in &options.moves {
        let uci = UciMove::from_ascii(m.as_bytes())?;
        let mv = uci.to_move(&pos)?;
        pos.play_unchecked(&mv);
    }
    let legal_count = pos.legal_moves().len() as u16;

    // Force MultiPV to number of legal moves BEFORE creating cache key
    let mut adjusted = options.clone();
    if let Some(opt) = adjusted
        .extra_options
        .iter_mut()
        .find(|x| x.name == "MultiPV")
    {
        opt.value = legal_count.to_string();
    } else {
        adjusted.extra_options.push(EngineOption {
            name: "MultiPV".to_string(),
            value: legal_count.to_string(),
        });
    }

    // Create cache key with the ADJUSTED options
    let cache_key = EngineCacheKey {
        fen: options.fen.clone(),
        moves: options.moves.clone(),
        engine_path: engine.clone(),
        engine_options: adjusted.extra_options.clone(),
        go_mode: go_mode.clone(),
    };

    // Check cache first (but only for non-infinite modes and if cache is enabled)
    if options.use_cache && !matches!(go_mode, GoMode::Infinite) {
        if let Ok(Some(cached_result)) = get_cached_analysis(&cache_key, &app).await {
            info!("Cache hit for score_all_moves: {}", cache_key.to_hash_string());
            // Convert cached BestMoves to MoveScore format
            let result: Vec<MoveScore> = cached_result.to_best_moves()
                .into_iter()
                .filter_map(|bm| {
                    bm.uci_moves.first().map(|uci| MoveScore {
                        uci: uci.clone(),
                        score: bm.score.clone(),
                    })
                })
                .collect();
            return Ok(result);
        }
    }

    // Prepare engine process
    let path = PathBuf::from(&engine);
    let (mut process, mut reader) = EngineProcess::new(path).await?;

    process.set_options(adjusted.clone()).await?;
    process.go(&go_mode).await?;

    let mut scores: HashMap<String, Score> = HashMap::new();

    while let Some(line) = reader.next_line().await? {
        match parse_one(&line) {
            UciMessage::Info(attrs) => {
                if let Ok(best_moves) =
                    parse_uci_attrs(attrs, &adjusted.fen.parse()?, &adjusted.moves)
                {
                    if let Some(first_uci) = best_moves.uci_moves.first().cloned() {
                        scores.insert(first_uci, best_moves.score);
                    }
                }
            }
            UciMessage::BestMove { .. } => {
                // Store analysis in cache before exiting (but not for infinite mode and only if cache is enabled)
                if options.use_cache && !matches!(go_mode, GoMode::Infinite) && !scores.is_empty() {
                    // Convert scores to BestMoves format for caching
                    let best_moves: Vec<BestMoves> = scores.iter().map(|(uci, score)| {
                        BestMoves {
                            nodes: 0, // We don't have this data in score_all_moves
                            depth: 1, // Placeholder depth
                            score: score.clone(),
                            uci_moves: vec![uci.clone()],
                            san_moves: vec![], // We don't have SAN moves here
                            multipv: 1,
                            nps: 0,
                        }
                    }).collect();
                    
                    let cached_result = CachedAnalysisResult::new(best_moves);
                    if let Err(e) = store_analysis_in_cache(&cache_key, &cached_result, &app).await {
                        info!("Failed to store score_all_moves in cache: {:?}", e);
                    } else {
                        info!("Stored score_all_moves in cache: {}", cache_key.to_hash_string());
                    }
                }
                
                // Ensure engine process exits to avoid leaks
                let _ = process.kill().await;
                break;
            }
            _ => {}
        }
    }

    let result: Vec<MoveScore> = scores
        .into_iter()
        .map(|(uci, score)| MoveScore { uci, score })
        .collect();

    Ok(result)
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
    let path = PathBuf::from(&engine);
    let mut analysis: Vec<MoveAnalysis> = Vec::new();

    let (mut proc, mut reader) = EngineProcess::new(path).await?;

    let fen = Fen::from_ascii(options.fen.as_bytes())?;

    let mut chess: Chess = fen.clone().into_position(CastlingMode::Chess960)?;
    let mut fens: Vec<(Fen, Vec<String>, bool)> = vec![(fen, vec![], false)];

    options.moves.iter().enumerate().for_each(|(i, m)| {
        let uci = UciMove::from_ascii(m.as_bytes()).unwrap();
        let m = uci.to_move(&chess).unwrap();
        let previous_pos = chess.clone();
        chess.play_unchecked(&m);
        let current_pos = chess.clone();
        if !chess.is_game_over() {
            let prev_eval = naive_eval(&previous_pos);
            let cur_eval = -naive_eval(&current_pos);
            fens.push((
                Fen::from_position(current_pos, EnPassantMode::Legal),
                options.moves.clone().into_iter().take(i + 1).collect(),
                prev_eval > cur_eval + 100,
            ));
        }
    });

    if options.reversed {
        fens.reverse();
    }

    let mut novelty_found = false;

    for (i, (_, moves, _)) in fens.iter().enumerate() {
        ReportProgress {
            progress: (i as f64 / fens.len() as f64) * 100.0,
            id: id.clone(),
            finished: false,
        }
        .emit(&app)?;

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
            use_cache: true, // analyze_game doesn't use cache anyway, but we need to provide a value
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
                    GameQueryJs::new().position(query.clone()).clone(),
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
    ReportProgress {
        progress: 100.0,
        id: id.clone(),
        finished: true,
    }
    .emit(&app)?;
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
        new_position.play_unchecked(capture);
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
            new_position.play_unchecked(mv);
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
        assert_eq!(naive_eval(&position), 100);
    }

    #[test]
    fn eval_complex_center() {
        let position = pos("r1bqkbnr/ppp2ppp/2n5/1B1pp3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4");
        assert_eq!(naive_eval(&position), 100);
    }

    #[test]
    fn eval_in_check() {
        let position = pos("r1bqkbnr/ppp2ppp/2B5/3pp3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 4");
        assert_eq!(naive_eval(&position), -100);
    }

    #[test]
    fn eval_rook_stack() {
        let position = pos("rnrq4/8/8/1R6/1R6/1R5K/1Q6/7k w - - 0 1");
        assert_eq!(naive_eval(&position), 500);
    }

    #[test]
    fn eval_rook_stack2() {
        let position = pos("rnrq4/8/8/1R6/1Q6/1R5K/1R6/7k w - - 0 1");
        assert_eq!(naive_eval(&position), 200);
    }

    #[test]
    fn eval_opera_game1() {
        let position = pos("4kb1r/p2rqppp/5n2/1B2p1B1/4P3/1Q6/PPP2PPP/2K4R w k - 0 14");
        assert_eq!(naive_eval(&position), -100);
    }

    #[test]
    fn eval_opera_game2() {
        let position = pos("4kb1r/p2rqppp/5n2/1B2p1B1/4P3/1Q6/PPP2PPP/2KR4 b k - 1 14");
        assert_eq!(naive_eval(&position), 0);
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
    let mut child = start_engine(path)?;
    let (mut stdin, mut stdout) = get_handles(&mut child)?;

    send_command(&mut stdin, "uci\n").await;

    let mut config = EngineConfig::default();

    loop {
        if let Some(line) = stdout.next_line().await? {
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
    }
    println!("{:?}", config);
    Ok(config)
}

// Cache query result structs
#[derive(diesel::QueryableByName)]
struct CacheQueryResult {
    #[diesel(sql_type = diesel::sql_types::Text)]
    best_moves: String,
    #[diesel(sql_type = diesel::sql_types::Text)]
    go_mode: String,
    #[diesel(sql_type = diesel::sql_types::Integer)]
    created_at: i32,
    #[diesel(sql_type = diesel::sql_types::Integer)]
    last_accessed: i32,
}

#[derive(diesel::QueryableByName)]
struct CountQueryResult {
    #[diesel(sql_type = diesel::sql_types::Integer)]
    count: i32,
}

// Cache management functions
async fn get_cache_db_path(app: &tauri::AppHandle) -> Result<PathBuf, Error> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|_| Error::CacheError)?;
    Ok(app_data_dir.join("cache").join("engine_cache.db"))
}

async fn ensure_cache_db_exists(app: &tauri::AppHandle) -> Result<(), Error> {
    use diesel::prelude::*;

    use diesel::SqliteConnection;
    
    let cache_path = get_cache_db_path(app).await?;
    
    // Create cache directory if it doesn't exist
    if let Some(parent) = cache_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    
    // Create database if it doesn't exist
    if !cache_path.exists() {
        let mut connection = SqliteConnection::establish(cache_path.to_str().unwrap())?;
        
        connection.batch_execute(
            "CREATE TABLE EngineCache (
                ID INTEGER PRIMARY KEY AUTOINCREMENT,
                CacheKey TEXT UNIQUE NOT NULL,
                FEN TEXT NOT NULL,
                Moves TEXT NOT NULL,
                EnginePath TEXT NOT NULL,
                EngineOptions TEXT NOT NULL,
                GoMode TEXT NOT NULL,
                BestMoves TEXT NOT NULL,
                Depth INTEGER NOT NULL,
                Nodes INTEGER NOT NULL,
                CreatedAt INTEGER NOT NULL,
                LastAccessed INTEGER NOT NULL
            );
            CREATE INDEX idx_engine_cache_key ON EngineCache(CacheKey);
            CREATE INDEX idx_engine_cache_accessed ON EngineCache(LastAccessed);"
        )?;
    }
    
    Ok(())
}

async fn get_cached_analysis(
    cache_key: &EngineCacheKey,
    app: &tauri::AppHandle,
) -> Result<Option<CachedAnalysisResult>, Error> {
    use diesel::prelude::*;
    use diesel::SqliteConnection;
    
    ensure_cache_db_exists(app).await?;
    let cache_path = get_cache_db_path(app).await?;
    
    // Retry logic for database locks
    for attempt in 0..3 {
        match SqliteConnection::establish(cache_path.to_str().unwrap()) {
            Ok(mut connection) => {
                // Set a short timeout for database operations
                let _ = connection.batch_execute("PRAGMA busy_timeout = 1000;");
                
                let key_hash = cache_key.to_hash_string();
                
                let result: Result<Option<CacheQueryResult>, _> = diesel::sql_query(
                    "SELECT BestMoves as best_moves, GoMode as go_mode, CreatedAt as created_at, LastAccessed as last_accessed FROM EngineCache WHERE CacheKey = ?1"
                )
                .bind::<diesel::sql_types::Text, _>(&key_hash)
                .get_result::<CacheQueryResult>(&mut connection)
                .optional();
                
                match result {
                    Ok(Some(cache_result)) => {
                        let serializable_best_moves: Vec<SerializableBestMoves> = serde_json::from_str(&cache_result.best_moves)
                            .map_err(|_| Error::CacheError)?;
                        let stored_go_mode: GoMode = serde_json::from_str(&cache_result.go_mode)
                            .map_err(|_| Error::CacheError)?;
                        
                        // Verify the go mode matches (important for cache validity)
                        if stored_go_mode == cache_key.go_mode {
                            // Update last accessed time
                            let _ = diesel::sql_query("UPDATE EngineCache SET LastAccessed = ?1 WHERE CacheKey = ?2")
                                .bind::<diesel::sql_types::Integer, _>(
                                    std::time::SystemTime::now()
                                        .duration_since(std::time::UNIX_EPOCH)
                                        .unwrap()
                                        .as_secs() as i32
                                )
                                .bind::<diesel::sql_types::Text, _>(&key_hash)
                                .execute(&mut connection);
                            
                            let mut cached_result = CachedAnalysisResult {
                                best_moves: serializable_best_moves,
                                depth: 0, // Will be calculated
                                nodes: 0, // Will be calculated
                                created_at: cache_result.created_at as i64,
                                last_accessed: cache_result.last_accessed as i64,
                            };
                            cached_result.touch();
                            
                            return Ok(Some(cached_result));
                        }
                    }
                    Ok(None) => return Ok(None),
                    Err(e) => {
                        if attempt < 2 && format!("{:?}", e).contains("database is locked") {
                            // Wait and retry for lock errors
                            tokio::time::sleep(std::time::Duration::from_millis(50 * (attempt + 1) as u64)).await;
                            continue;
                        } else {
                            return Err(e.into());
                        }
                    }
                }
            }
            Err(e) => {
                if attempt < 2 && format!("{:?}", e).contains("database is locked") {
                    // Wait and retry for connection errors
                    tokio::time::sleep(std::time::Duration::from_millis(50 * (attempt + 1) as u64)).await;
                    continue;
                } else {
                    return Err(e.into());
                }
            }
        }
    }
    
    Ok(None)
}

async fn store_analysis_in_cache(
    cache_key: &EngineCacheKey,
    result: &CachedAnalysisResult,
    app: &tauri::AppHandle,
) -> Result<(), Error> {
    use diesel::prelude::*;
    use diesel::SqliteConnection;
    
    ensure_cache_db_exists(app).await?;
    let cache_path = get_cache_db_path(app).await?;
    
    // Retry logic for database locks
    for attempt in 0..3 {
        match SqliteConnection::establish(cache_path.to_str().unwrap()) {
            Ok(mut connection) => {
                // Set a short timeout for database operations
                let _ = connection.batch_execute("PRAGMA busy_timeout = 1000;");
                
                let key_hash = cache_key.to_hash_string();
                let moves_json = serde_json::to_string(&cache_key.moves)
                    .map_err(|_| Error::CacheError)?;
                let options_json = serde_json::to_string(&cache_key.engine_options)
                    .map_err(|_| Error::CacheError)?;
                let go_mode_json = serde_json::to_string(&cache_key.go_mode)
                    .map_err(|_| Error::CacheError)?;
                let best_moves_json = serde_json::to_string(&result.best_moves)
                    .map_err(|_| Error::CacheError)?;
                
                let insert_result = diesel::sql_query(
                    "INSERT OR REPLACE INTO EngineCache 
                     (CacheKey, FEN, Moves, EnginePath, EngineOptions, GoMode, BestMoves, Depth, Nodes, CreatedAt, LastAccessed)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)"
                )
                .bind::<diesel::sql_types::Text, _>(&key_hash)
                .bind::<diesel::sql_types::Text, _>(&cache_key.fen)
                .bind::<diesel::sql_types::Text, _>(&moves_json)
                .bind::<diesel::sql_types::Text, _>(&cache_key.engine_path)
                .bind::<diesel::sql_types::Text, _>(&options_json)
                .bind::<diesel::sql_types::Text, _>(&go_mode_json)
                .bind::<diesel::sql_types::Text, _>(&best_moves_json)
                .bind::<diesel::sql_types::Integer, _>(result.depth as i32)
                .bind::<diesel::sql_types::Integer, _>(result.nodes as i32)
                .bind::<diesel::sql_types::Integer, _>(result.created_at as i32)
                .bind::<diesel::sql_types::Integer, _>(result.last_accessed as i32)
                .execute(&mut connection);
                
                match insert_result {
                    Ok(_) => return Ok(()),
                    Err(e) => {
                        if attempt < 2 && format!("{:?}", e).contains("database is locked") {
                            // Wait and retry for lock errors
                            tokio::time::sleep(std::time::Duration::from_millis(50 * (attempt + 1) as u64)).await;
                            continue;
                        } else {
                            return Err(e.into());
                        }
                    }
                }
            }
            Err(e) => {
                if attempt < 2 && format!("{:?}", e).contains("database is locked") {
                    // Wait and retry for connection errors
                    tokio::time::sleep(std::time::Duration::from_millis(50 * (attempt + 1) as u64)).await;
                    continue;
                } else {
                    return Err(e.into());
                }
            }
        }
    }
    
    Err(Error::CacheError)
}

async fn cleanup_old_cache_entries(app: &tauri::AppHandle, max_entries: i32) -> Result<(), Error> {
    use diesel::prelude::*;
    use diesel::SqliteConnection;
    
    let cache_path = get_cache_db_path(app).await?;
    if !cache_path.exists() {
        return Ok(());
    }
    
    let mut connection = SqliteConnection::establish(cache_path.to_str().unwrap())?;
    
    // Delete oldest entries if we exceed max_entries
    diesel::sql_query(
        "DELETE FROM EngineCache WHERE ID IN (
            SELECT ID FROM EngineCache 
            ORDER BY LastAccessed DESC 
            LIMIT -1 OFFSET ?1
         )"
    )
    .bind::<diesel::sql_types::Integer, _>(max_entries)
    .execute(&mut connection)?;
    
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn clear_engine_cache(app: tauri::AppHandle) -> Result<(), Error> {
    use diesel::prelude::*;
    use diesel::SqliteConnection;
    
    let cache_path = get_cache_db_path(&app).await?;
    if !cache_path.exists() {
        return Ok(());
    }
    
    let mut connection = SqliteConnection::establish(cache_path.to_str().unwrap())?;
    
    diesel::sql_query("DELETE FROM EngineCache")
        .execute(&mut connection)?;
    
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn get_cache_stats(app: tauri::AppHandle) -> Result<(i32, i64), Error> {
    use diesel::prelude::*;
    use diesel::SqliteConnection;
    
    let cache_path = get_cache_db_path(&app).await?;
    if !cache_path.exists() {
        return Ok((0, 0));
    }
    
    let mut connection = SqliteConnection::establish(cache_path.to_str().unwrap())?;
    
    let count_result: CountQueryResult = diesel::sql_query("SELECT COUNT(*) as count FROM EngineCache")
        .get_result::<CountQueryResult>(&mut connection)?;
    let count = count_result.count;
    
    let size = std::fs::metadata(&cache_path)?
        .len();
    
    Ok((count, size as i64))
}
