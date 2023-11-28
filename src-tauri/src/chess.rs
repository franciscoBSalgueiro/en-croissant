use std::{fmt::Display, path::PathBuf, process::Stdio, sync::Arc};

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

#[derive(Debug)]
pub struct EngineProcess {
    stdin: ChildStdin,
    last_depth: u8,
    best_moves: Vec<BestMoves>,
    last_best_moves: Vec<BestMoves>,
    options: EngineOptions,
    go_mode: GoMode,
    running: bool,
    real_multipv: u16,
    logs: Vec<EngineLog>,
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
        let mut lines = BufReader::new(child.stdout.take().ok_or(Error::NoStdout)?).lines();

        stdin.write_all("uci\n".as_bytes()).await;
        logs.push(EngineLog::Gui("uci\n".to_string()));
        while let Some(line) = lines.next_line().await? {
            logs.push(EngineLog::Engine(line.clone()));
            if line == "uciok" {
                break;
            }
        }

        Ok((
            Self {
                stdin,
                last_depth: 0,
                best_moves: Vec::new(),
                last_best_moves: Vec::new(),
                logs,
                options: EngineOptions::default(),
                real_multipv: 0,
                go_mode: GoMode::Infinite,
                running: false,
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
        let pos: Chess = match fen.into_position(CastlingMode::Standard) {
            Ok(p) => p,
            Err(e) => e.ignore_too_much_material()?,
        };
        self.real_multipv = options.multipv.min(pos.legal_moves().len() as u16);
        if options.threads != self.options.threads {
            self.set_option("Threads", &options.threads).await?;
        }
        if options.multipv != self.options.multipv {
            self.set_option("MultiPV", &options.multipv).await?;
        }
        if options.hash != self.options.hash {
            self.set_option("Hash", options.hash).await?;
        }

        for option in &options.extra_options {
            if !self.options.extra_options.contains(option) {
                self.set_option(&option.name, &option.value).await?;
            }
        }

        if options.fen != self.options.fen {
            self.set_position(&options.fen).await?;
        }
        self.last_depth = 0;
        self.options = options.clone();
        self.best_moves.clear();
        self.last_best_moves.clear();
        Ok(())
    }

    async fn set_position(&mut self, fen: &str) -> Result<(), Error> {
        let msg = format!("position fen {}\n", fen);
        self.stdin.write_all(msg.as_bytes()).await?;
        self.options.fen = fen.to_string();
        self.logs.push(EngineLog::Gui(msg));
        Ok(())
    }

    async fn go(&mut self, mode: &GoMode) -> Result<(), Error> {
        self.go_mode = mode.clone();
        let msg = match mode {
            GoMode::Depth(depth) => format!("go depth {}\n", depth),
            GoMode::Time(time) => format!("go movetime {}\n", time),
            GoMode::Nodes(nodes) => format!("go nodes {}\n", nodes),
            GoMode::Infinite => "go infinite\n".to_string(),
        };
        self.stdin.write_all(msg.as_bytes()).await?;
        self.logs.push(EngineLog::Gui(msg));
        self.running = true;
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

#[derive(Deserialize, Debug, Clone, Type, Derivative, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derivative(Default)]
pub struct EngineOptions {
    pub multipv: u16,
    pub threads: u16,
    pub hash: u16,
    #[derivative(Default(value = "Fen::default().to_string()"))]
    pub fen: String,
    pub extra_options: Vec<EngineOption>,
}

#[derive(Deserialize, Debug, Clone, Type, PartialEq, Eq)]
pub struct EngineOption {
    name: String,
    value: String,
}

#[derive(Deserialize, Debug, Clone, Type, PartialEq, Eq)]
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
) -> Result<Option<Vec<BestMoves>>, Error> {
    let path = PathBuf::from(&engine);

    let key = (tab.clone(), engine.clone());

    if state.engine_processes.contains_key(&key) {
        {
            let process = state.engine_processes.get_mut(&key).unwrap();
            let mut process = process.lock().await;
            if options == process.options && go_mode == process.go_mode && process.running {
                return Ok(Some(process.last_best_moves.clone()));
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

    while let Some(line) = reader.next_line().await? {
        let mut proc = process.lock().await;
        if let UciMessage::Info(attrs) = parse_one(&line) {
            if let Ok(best_moves) = parse_uci_attrs(attrs, &proc.options.fen.parse()?) {
                let multipv = best_moves.multipv;
                let cur_depth = best_moves.depth;
                if multipv as usize == proc.best_moves.len() + 1 {
                    proc.best_moves.push(best_moves);
                    if multipv == proc.real_multipv {
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
                            proc.last_best_moves = proc.best_moves.clone();
                        }
                        proc.best_moves.clear();
                    }
                }
            }
        }
        proc.logs.push(EngineLog::Engine(line));
    }
    info!("Engine process finished: tab: {}, engine: {}", tab, engine);
    state.engine_processes.remove(&key).unwrap();
    Ok(None)
}

#[derive(Serialize, Debug, Default, Type)]
pub struct MoveAnalysis {
    best: Vec<BestMoves>,
    novelty: bool,
    maybe_brilliant: bool,
}

#[derive(Deserialize, Debug, Default, Type)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisOptions {
    pub fen: String,
    pub annotate_novelties: bool,
    pub reference_db: Option<PathBuf>,
    pub reversed: bool,
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

    let (mut proc, mut reader) = EngineProcess::new(path).await?;

    let fen = Fen::from_ascii(options.fen.as_bytes())?;

    let mut chess: Chess = fen.clone().into_position(CastlingMode::Standard)?;
    let mut fens: Vec<(Fen, bool)> = vec![(fen, false)];

    moves.iter().for_each(|m| {
        let san = San::from_ascii(m.as_bytes()).unwrap();
        let m = san.to_move(&chess).unwrap();
        let mut previous_setup = chess.clone().into_setup(EnPassantMode::Legal);
        previous_setup.swap_turn();
        chess.play_unchecked(&m);
        let current_setup = chess.clone().into_setup(EnPassantMode::Legal);
        if !chess.is_game_over() {
            fens.push((
                Fen::from_position(chess.clone(), EnPassantMode::Legal),
                count_attacked_material(&previous_setup) <= count_attacked_material(&current_setup),
            ));
        }
    });

    if options.reversed {
        fens.reverse();
    }

    let mut novelty_found = false;

    for (i, (fen, maybe_brilliant)) in fens.iter().enumerate() {
        app.emit_all(
            "report_progress",
            ProgressPayload {
                progress: (i as f64 / fens.len() as f64) * 100.0,
                id: 0,
                finished: false,
            },
        )?;

        proc
            .set_options(EngineOptions {
                threads: 4,
                multipv: 1,
                hash: 16,
                fen: fen.to_string(),
                extra_options: Vec::new(),
            })
            .await?;

        proc.go(&go_mode).await?;

        let mut current_analysis = MoveAnalysis::default();
        while let Ok(Some(line)) = reader.next_line().await {
            match parse_one(&line) {
                UciMessage::Info(attrs) => {
                    if let Ok(best_moves) = parse_uci_attrs(attrs, &proc.options.fen.parse()?) {
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
        println!("Analysis: {:?}", current_analysis);
        analysis.push(current_analysis);
    }

    if options.reversed {
        analysis.reverse();
        fens.reverse();
    }

    for (i, analysis) in analysis.iter_mut().enumerate() {
        let fen = &fens[i].0;
        let query = PositionQuery::exact_from_fen(&fen.to_string())?;

        analysis.maybe_brilliant = fens[i].1;
        if options.annotate_novelties && !novelty_found {
            if let Some(reference) = options.reference_db.clone() {
                analysis.novelty = !is_position_in_db(reference, query, state.clone()).await?;
                if analysis.novelty {
                    novelty_found = true;
                }
            } else {
                return Err(Error::MissingReferenceDatabase);
            }
        }
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

fn count_attacked_material(pos: &Setup) -> i32 {
    let mut attacked_material = 0;
    let mut seen_attacked = Vec::new();
    for s in Square::ALL.iter() {
        if let Some(piece) = pos.board.piece_at(*s) {
            if piece.color == pos.turn {
                let squares_attacked = pos.board.attacks_from(*s);
                for square in Square::ALL.iter() {
                    if squares_attacked.contains(*square) && !seen_attacked.contains(square) {
                        if let Some(attacked_piece) = pos.board.piece_at(*square) {
                            seen_attacked.push(*square);
                            if attacked_piece.color != pos.turn {
                                attacked_material += match attacked_piece.role {
                                    Role::Pawn => 1,
                                    Role::Knight => 3,
                                    Role::Bishop => 3,
                                    Role::Rook => 5,
                                    Role::Queen => 9,
                                    Role::King => 1000,
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    attacked_material
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_count_attacked_material() {
        assert_eq!(count_attacked_material(&Setup::default()), 0);

        let fen: Fen = "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2"
            .parse()
            .unwrap();
        assert_eq!(count_attacked_material(&fen.into_setup()), 1);

        let fen: Fen = "r1bqkbnr/ppp1pppp/2n5/1B1p4/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3"
            .parse()
            .unwrap();
        assert_eq!(count_attacked_material(&fen.into_setup()), 1);

        let fen: Fen = "r1bqkbnr/ppp2ppp/2n5/1B1pp3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4"
            .parse()
            .unwrap();
        assert_eq!(count_attacked_material(&fen.into_setup()), 5);

        let fen: Fen = "r1bqkbnr/ppp2ppp/2B5/3pp3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 4"
            .parse()
            .unwrap();
        assert_eq!(count_attacked_material(&fen.into_setup()), 4);

        let fen: Fen = "r1bqkbnr/ppp2ppp/2B5/3pp3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq"
            .parse()
            .unwrap();
        assert_eq!(count_attacked_material(&fen.into_setup()), 1003);
    }
}

#[tauri::command]
#[specta::specta]
pub async fn get_single_best_move(
    go_mode: GoMode,
    options: EngineOptions,
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

    
    let (mut process, mut reader) = EngineProcess::new(path).await?;
    process.set_options(options.clone()).await?;
    process.go(&go_mode).await?;

    loop {
        if let Some(line) = reader.next_line().await? {
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
