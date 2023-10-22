use std::{path::PathBuf, process::Stdio, sync::Arc};

use derivative::Derivative;
use log::info;
use rand::seq::SliceRandom;
use serde::{Deserialize, Serialize};
use shakmaty::{
    fen::Fen, san::San, san::SanPlus, uci::Uci, CastlingMode, Chess, Color, EnPassantMode,
    FromSetup, Piece, Position, PositionErrorKinds, Role, Setup, Square,
};
use specta::Type;
use tauri::{
    api::path::{resolve_path, BaseDirectory},
    Manager,
};
use tauri_specta::Event;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader, Lines},
    process::{Child, ChildStdin, ChildStdout, Command},
    sync::Mutex,
};
use vampirc_uci::{parse_one, UciInfoAttribute, UciMessage};

use crate::{
    db::{is_position_in_db, PositionQuery},
    error::Error,
    fs::ProgressPayload,
    AppState,
};

#[derive(Debug, Clone, Serialize, Type)]
#[serde(tag = "type", content = "value", rename_all = "camelCase")]
pub enum EngineLog {
    Gui(String),
    Engine(String),
}

pub struct EngineProcess {
    stdin: ChildStdin,
    last_depth: u8,
    best_moves: Vec<BestMoves>,
    fen: Fen,
    multipv: u16,
    logs: Vec<EngineLog>,
}

impl EngineProcess {
    fn new(path: PathBuf) -> Result<(Self, Lines<BufReader<ChildStdout>>), Error> {
        let mut command = Command::new(&path);
        command.current_dir(path.parent().unwrap());
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(target_os = "windows")]
        command.creation_flags(CREATE_NO_WINDOW);

        let mut child = command.spawn()?;

        Ok((
            Self {
                stdin: child.stdin.take().ok_or(Error::NoStdin)?,
                last_depth: 0,
                best_moves: Vec::new(),
                fen: Fen::default(),
                logs: Vec::new(),
                multipv: 1,
            },
            BufReader::new(child.stdout.take().ok_or(Error::NoStdout)?).lines(),
        ))
    }

    async fn set_option(&mut self, name: &str, value: &str) -> Result<(), Error> {
        let msg = format!("setoption name {} value {}\n", name, value);
        self.stdin.write_all(msg.as_bytes()).await?;
        self.logs.push(EngineLog::Gui(msg));

        Ok(())
    }

    async fn set_options(&mut self, options: EngineOptions) -> Result<(), Error> {
        let fen: Fen = options.fen.parse()?;
        let pos: Chess = match fen.into_position(CastlingMode::Standard) {
            Ok(p) => p,
            Err(e) => e.ignore_too_much_material()?,
        };
        self.multipv = options.multipv.min(pos.legal_moves().len() as u16);
        self.set_option("Threads", &options.threads.to_string())
            .await?;
        self.set_option("MultiPV", &options.multipv.to_string())
            .await?;
        self.set_position(&options.fen).await?;
        self.last_depth = 0;
        self.best_moves.clear();
        Ok(())
    }

    async fn set_position(&mut self, fen: &str) -> Result<(), Error> {
        let msg = format!("position fen {}\n", fen);
        self.stdin.write_all(msg.as_bytes()).await?;
        self.fen = fen.parse()?;
        self.logs.push(EngineLog::Gui(msg));
        Ok(())
    }

    async fn go(&mut self, mode: &GoMode) -> Result<(), Error> {
        let msg = match mode {
            GoMode::Depth(depth) => format!("go depth {}\n", depth),
            GoMode::Time(time) => format!("go movetime {}\n", time),
            GoMode::Nodes(nodes) => format!("go nodes {}\n", nodes),
            GoMode::Infinite => "go infinite\n".to_string(),
        };
        self.stdin.write_all(msg.as_bytes()).await?;
        self.logs.push(EngineLog::Gui(msg));
        Ok(())
    }

    async fn stop(&mut self) -> Result<(), Error> {
        self.stdin.write_all(b"stop\n").await?;
        self.logs.push(EngineLog::Gui("stop\n".to_string()));
        Ok(())
    }

    async fn kill(&mut self) -> Result<(), Error> {
        self.stdin.write_all(b"quit\n").await?;
        self.logs.push(EngineLog::Gui("quit\n".to_string()));
        Ok(())
    }
}

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Copy, Clone, Type, Serialize)]
#[serde(tag = "type", content = "value", rename_all = "camelCase")]
pub enum Score {
    Cp(i32),
    Mate(i8),
}

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
    depth: u8,
    #[derivative(Default(value = "Score::Cp(0)"))]
    score: Score,
    #[serde(rename = "uciMoves")]
    uci_moves: Vec<String>,
    #[serde(rename = "sanMoves")]
    san_moves: Vec<String>,
    multipv: u16,
    nps: u32,
}

#[derive(Serialize, Debug, Clone, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct BestMovesPayload {
    pub best_lines: Vec<BestMoves>,
    pub engine: String,
    pub tab: String,
}

fn parse_uci_attrs(attrs: Vec<UciInfoAttribute>, fen: &Fen) -> Result<BestMoves, Error> {
    let mut best_moves = BestMoves::default();

    let mut pos: Chess = match fen.clone().into_position(CastlingMode::Standard) {
        Ok(p) => p,
        Err(e) => e.ignore_too_much_material()?,
    };
    let turn = pos.turn();

    for a in attrs {
        match a {
            UciInfoAttribute::Pv(m) => {
                for mv in m {
                    let uci: Uci = mv.to_string().parse()?;
                    let m = uci.to_move(&pos)?;
                    let san = SanPlus::from_move_and_play_unchecked(&mut pos, &m);
                    best_moves.san_moves.push(san.to_string());
                    best_moves.uci_moves.push(uci.to_string());
                }
            }
            UciInfoAttribute::Nps(nps) => {
                best_moves.nps = nps as u32;
            }
            UciInfoAttribute::Depth(depth) => {
                best_moves.depth = depth;
            }
            UciInfoAttribute::MultiPv(multipv) => {
                best_moves.multipv = multipv;
            }
            UciInfoAttribute::Score {
                cp,
                mate,
                lower_bound,
                upper_bound,
            } => {
                if let Some(cp) = cp {
                    best_moves.score = Score::Cp(cp);
                } else if let Some(mate) = mate {
                    best_moves.score = Score::Mate(mate);
                }
                if lower_bound.unwrap_or(false) || upper_bound.unwrap_or(false) {
                    return Err(Error::LowerOrUpperBound);
                }
            }
            _ => (),
        }
    }

    if best_moves.san_moves.is_empty() {
        return Err(Error::NoMovesFound);
    }

    if turn == Color::Black {
        best_moves.score = match best_moves.score {
            Score::Cp(x) => Score::Cp(-x),
            Score::Mate(x) => Score::Mate(-x),
        };
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

#[derive(Deserialize, Debug, Clone, Type)]
pub struct EngineOptions {
    pub multipv: u16,
    pub threads: u16,
    pub fen: String,
}

#[derive(Deserialize, Debug, Clone, Type)]
#[serde(tag = "t", content = "c")]
pub enum GoMode {
    Depth(u8),
    Time(u32),
    Nodes(u32),
    Infinite,
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
        if key.0 == tab {
            {
                let process = state.engine_processes.get_mut(&key).unwrap();
                let mut process = process.lock().await;
                process.kill().await?;
            }
            state.engine_processes.remove(&key).unwrap();
        }
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
    engine: String,
    tab: String,
    go_mode: GoMode,
    options: EngineOptions,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let path = PathBuf::from(&engine);

    let key = (tab.clone(), engine.clone());

    if state.engine_processes.contains_key(&key) {
        {
            let process = state.engine_processes.get_mut(&key).unwrap();
            let mut process = process.lock().await;
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
        return Ok(());
    }

    let (mut process, mut reader) = EngineProcess::new(path)?;
    process.set_options(options.clone()).await?;
    process.go(&go_mode).await?;

    let process = Arc::new(Mutex::new(process));

    state.engine_processes.insert(key.clone(), process.clone());

    while let Some(line) = reader.next_line().await? {
        let mut proc = process.lock().await;
        if let UciMessage::Info(attrs) = parse_one(&line) {
            if let Ok(best_moves) = parse_uci_attrs(attrs, &proc.fen) {
                let multipv = best_moves.multipv;
                let cur_depth = best_moves.depth;
                proc.best_moves.push(best_moves);
                if multipv == proc.multipv {
                    if proc.best_moves.iter().all(|x| x.depth == cur_depth)
                        && cur_depth >= proc.last_depth
                    {
                        BestMovesPayload {
                            best_lines: proc.best_moves.clone(),
                            engine: engine.clone(),
                            tab: tab.clone(),
                        }
                        .emit_all(&app)?;
                        proc.last_depth = cur_depth;
                    }
                    proc.best_moves.clear();
                }
            }
        }
        proc.logs.push(EngineLog::Engine(line));
    }
    info!("Engine process finished: tab: {}, engine: {}", tab, engine);
    state.engine_processes.remove(&key).unwrap();
    Ok(())
}

#[derive(Serialize, Debug, Default, Type)]
pub struct MoveAnalysis {
    best: BestMoves,
    novelty: bool,
}

#[derive(Deserialize, Debug, Default, Type)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisOptions {
    pub fen: String,
    pub annotate_novelties: bool,
    pub reference_db: Option<PathBuf>,
}

#[tauri::command]
#[specta::specta]
pub async fn analyze_game(
    moves: Vec<String>,
    engine: String,
    go_mode: GoMode,
    options: AnalysisOptions,
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<Vec<MoveAnalysis>, Error> {
    let path = PathBuf::from(&engine);
    let mut analysis: Vec<MoveAnalysis> = Vec::new();

    let (mut process, mut reader) = EngineProcess::new(path)?;
    let fen = Fen::from_ascii(options.fen.as_bytes())?;

    let mut chess: Chess = fen.into_position(CastlingMode::Standard)?;

    process
        .set_options(EngineOptions {
            threads: 4,
            multipv: 1,
            fen: options.fen.to_string(),
        })
        .await?;

    let len_moves = moves.len();

    let mut novelty_found = false;

    for (i, m) in moves.iter().enumerate() {
        app.emit_all(
            "report_progress",
            ProgressPayload {
                progress: (i as f64 / len_moves as f64) * 100.0,
                id: 0,
                finished: false,
            },
        )?;
        let san = San::from_ascii(m.as_bytes())?;
        let m = san.to_move(&chess)?;
        chess.play_unchecked(&m);
        if chess.is_game_over() {
            break;
        }
        let fen = Fen::from_position(chess.clone(), EnPassantMode::Legal);
        let query = PositionQuery::exact_from_fen(&fen.to_string())?;

        process
            .set_options(EngineOptions {
                threads: 4,
                multipv: 1,
                fen: fen.to_string(),
            })
            .await?;

        process.go(&go_mode).await?;

        let mut current_analysis = MoveAnalysis::default();
        while let Ok(Some(line)) = reader.next_line().await {
            match parse_one(&line) {
                UciMessage::Info(attrs) => {
                    if let Ok(best_moves) = parse_uci_attrs(attrs, &fen) {
                        current_analysis.best = best_moves;
                    }
                }
                UciMessage::BestMove { .. } => {
                    break;
                }
                _ => {}
            }
        }

        if options.annotate_novelties && !novelty_found {
            if let Some(reference) = options.reference_db.clone() {
                current_analysis.novelty =
                    !is_position_in_db(reference, query, state.clone()).await?;
                if current_analysis.novelty {
                    novelty_found = true;
                }
            } else {
                return Err(Error::MissingReferenceDatabase);
            }
        }
        analysis.push(current_analysis);
    }
    app.emit_all(
        "report_progress",
        ProgressPayload {
            progress: 1.0,
            id: 0,
            finished: true,
        },
    )?;
    Ok(analysis)
}

#[tauri::command]
pub async fn get_single_best_move(
    skill_level: usize,
    depth: usize,
    fen: String,
    engine: String,
    app: tauri::AppHandle,
) -> Result<String, Error> {
    let mut path = PathBuf::from(&engine);
    path = resolve_path(
        &app.config(),
        app.package_info(),
        &app.env(),
        path,
        Some(BaseDirectory::AppData),
    )?;
    let number_threads = 4;

    let mut child = start_engine(path)?;
    let (mut stdin, mut stdout) = get_handles(&mut child)?;

    send_command(&mut stdin, format!("position fen {}\n", &fen)).await;
    send_command(
        &mut stdin,
        format!("setoption name Skill Level value {}\n", &skill_level),
    )
    .await;
    send_command(
        &mut stdin,
        format!("setoption name Threads value {}\n", &number_threads),
    )
    .await;
    send_command(&mut stdin, format!("go depth {}\n", &depth)).await;

    loop {
        if let Some(line) = stdout.next_line().await? {
            if line.starts_with("bestmove") {
                let m = line.split_whitespace().nth(1).unwrap();
                info!("bestmove {}", m);
                return Ok(m.to_string());
            }
        }
    }
}

#[tauri::command]
pub async fn get_engine_name(path: PathBuf) -> Result<String, Error> {
    let mut child = start_engine(path)?;
    let (mut stdin, mut stdout) = get_handles(&mut child)?;

    send_command(&mut stdin, "uci\n").await;

    loop {
        if let Some(line) = stdout.next_line().await? {
            if let UciMessage::Id { name, author: _ } = parse_one(&line) {
                return Ok(name.unwrap_or_default());
            }
        }
    }
}

#[tauri::command]
pub fn put_piece(fen: String, piece: char, square: String, color: char) -> Result<String, String> {
    let fen: Fen = fen.parse().or(Err("Invalid fen"))?;
    let mut pos: Setup = fen.into_setup();
    let piece = Piece {
        role: Role::from_char(piece).unwrap(),
        color: Color::from_char(color).unwrap(),
    };
    let square = Square::from_ascii(square.as_bytes()).or(Err("Invalid square"))?;
    pos.board.set_piece_at(square, piece);
    let fen = Fen::from_setup(pos);
    Ok(fen.to_string())
}

#[tauri::command]
pub fn make_move(fen: String, from: String, to: String) -> Result<String, String> {
    let fen: Fen = fen.parse().or(Err("Invalid fen"))?;
    let mut pos: Setup = fen.into_setup();
    let from = Square::from_ascii(from.as_bytes()).or(Err("Invalid square"))?;
    let to = Square::from_ascii(to.as_bytes()).or(Err("Invalid square"))?;
    let from_piece = pos.board.piece_at(from).unwrap();

    pos.board.set_piece_at(to, from_piece);
    pos.board.remove_piece_at(from).unwrap();

    if let Err(e) = Chess::from_setup(pos.clone(), CastlingMode::Standard) {
        if e.kinds()
            .contains(PositionErrorKinds::INVALID_CASTLING_RIGHTS)
        {
            pos.castling_rights.clear();
        }
    }

    let fen = Fen::from_setup(pos);
    Ok(fen.to_string())
}

#[tauri::command]
pub fn make_random_move(fen: String) -> Result<String, Error> {
    let fen: Fen = fen.parse()?;
    let pos: Chess = fen.into_position(CastlingMode::Standard)?;
    let legal_moves = pos.legal_moves();
    let mut rng = rand::thread_rng();
    let random_move = legal_moves.choose(&mut rng).ok_or(Error::NoLegalMoves)?;
    let uci = Uci::from_move(random_move, CastlingMode::Standard);
    Ok(uci.to_string())
}

#[derive(Serialize, Deserialize, Debug)]
pub struct FenValidation {
    pub valid: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn validate_fen(fen: String) -> Result<FenValidation, ()> {
    match fen.parse::<Fen>() {
        Ok(_) => Ok(FenValidation {
            valid: true,
            error: None,
        }),
        Err(err) => Ok(FenValidation {
            valid: false,
            error: Some(err.to_string()),
        }),
    }
}

#[tauri::command]
pub async fn similar_structure(fen: String) -> Result<String, Error> {
    let fen: Fen = fen.parse()?;
    let mut setup = fen.as_setup().clone();

    // remove all pieces except pawns
    for square in Square::ALL.iter() {
        if let Some(piece) = setup.board.piece_at(*square) {
            if piece.role != Role::Pawn {
                setup.board.remove_piece_at(*square).unwrap();
            }
        }
    }

    Ok(Fen::from_setup(setup).to_string())
}

#[derive(Serialize, Debug)]
pub struct PieceCount {
    pub p: i8,
    pub n: i8,
    pub b: i8,
    pub r: i8,
    pub q: i8,
}

#[tauri::command]
pub async fn get_pieces_count(fen: String) -> Result<PieceCount, Error> {
    let fen: Fen = fen.parse()?;
    let setup = fen.as_setup().clone();

    let mut counts = PieceCount {
        p: 0,
        n: 0,
        b: 0,
        r: 0,
        q: 0,
    };

    for square in Square::ALL.iter() {
        if let Some(piece) = setup.board.piece_at(*square) {
            let color = match piece.color {
                Color::White => 1,
                Color::Black => -1,
            };
            match piece.role {
                Role::Pawn => counts.p += color,
                Role::Knight => counts.n += color,
                Role::Bishop => counts.b += color,
                Role::Rook => counts.r += color,
                Role::Queen => counts.q += color,
                _ => (),
            }
        }
    }

    Ok(counts)
}
