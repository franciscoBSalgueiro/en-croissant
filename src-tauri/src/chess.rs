use std::{path::PathBuf, process::Stdio};

use derivative::Derivative;
use log::{info, error};
use rand::seq::SliceRandom;
use serde::{Deserialize, Serialize};
use shakmaty::{
    fen::Fen, san::San, san::SanPlus, uci::Uci, CastlingMode, Chess, Color, EnPassantMode,
    FromSetup, Piece, Position, PositionErrorKinds, Role, Setup, Square,
};
use tauri::{
    api::path::{resolve_path, BaseDirectory},
    Manager,
};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader, Lines},
    process::{Child, ChildStdin, ChildStdout, Command},
};
use vampirc_uci::{parse_one, UciInfoAttribute, UciMessage};

use crate::{
    db::{is_position_in_db, PositionQuery},
    error::Error,
    fs::ProgressPayload,
    AppState,
};

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Copy, Clone)]
pub enum Score {
    Cp(i64),
    Mate(i64),
}

#[derive(serde::Serialize)]
struct ScoreJson {
    #[serde(rename = "type")]
    score_type: &'static str,
    value: i64,
}

impl serde::Serialize for Score {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let score_json = match self {
            Score::Cp(value) => ScoreJson {
                score_type: "cp",
                value: *value,
            },
            Score::Mate(value) => ScoreJson {
                score_type: "mate",
                value: *value,
            },
        };
        score_json.serialize(serializer)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct AnalysisCacheKey {
    pub tab: String,
    pub fen: String,
    pub engine: String,
    pub multipv: u16,
}

#[derive(Clone, Serialize, Debug, Derivative)]
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
    nps: u64,
}

#[derive(Serialize, Debug)]
pub struct BestMovesPayload {
    #[serde(rename = "bestLines")]
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
                best_moves.nps = nps;
            }
            UciInfoAttribute::Depth(depth) => {
                best_moves.depth = depth;
            }
            UciInfoAttribute::MultiPv(multipv) => {
                best_moves.multipv = multipv;
            }
            UciInfoAttribute::Score { cp, mate, .. } => {
                if let Some(cp) = cp {
                    best_moves.score = Score::Cp(cp as i64);
                } else if let Some(mate) = mate {
                    best_moves.score = Score::Mate(mate as i64);
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

#[derive(Deserialize, Debug, Clone)]
pub struct EngineOptions {
    pub depth: u8,
    pub multipv: u16,
    pub threads: usize,
}

#[tauri::command]
pub async fn get_best_moves(
    engine: String,
    tab: String,
    fen: String,
    options: EngineOptions,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let path = PathBuf::from(&engine);

    let parsed_fen: Fen = fen.parse()?;
    let pos: Chess = match parsed_fen.clone().into_position(CastlingMode::Standard) {
        Ok(p) => p,
        Err(e) => e.ignore_too_much_material()?,
    };

    let mut options = options.clone();
    options.multipv = options.multipv.min(pos.legal_moves().len() as u16);

    let key = AnalysisCacheKey {
        fen: fen.clone(),
        engine: engine.clone(),
        tab: tab.clone(),
        multipv: options.multipv,
    };

    let mut last_depth = 0;

    if state.analysis_cache.contains_key(&key) {
        let payload = state.analysis_cache.get(&key).unwrap();
        let best_moves_payload = BestMovesPayload {
            best_lines: payload.to_vec(),
            engine: engine.clone(),
            tab: tab.clone(),
        };
        app.emit_all("best_moves", &Some(best_moves_payload))?;
        let cached_depth = payload[0].depth;
        if cached_depth >= options.depth {
            return Ok(());
        }
        last_depth = cached_depth;
    }

    let mut child = start_engine(path)?;
    let (mut stdin, mut stdout) = get_handles(&mut child)?;

    let (tx, mut rx) = tokio::sync::broadcast::channel(16);

    let eng_id = engine.clone();
    let id = app.listen_global("stop_engine", move |event| {
        let payload = event.payload().unwrap();
        let payload = payload[1..payload.len() - 1].replace("\\\\", "\\");
        if payload == eng_id {
            tx.send(()).unwrap();
        }
    });

    tokio::spawn(async move {
        // run engine process and wait for exit code
        let status = child
            .wait()
            .await
            .expect("engine process encountered an error");
        info!("engine process exit status : {}", status);
    });

    let mut best_moves_payload = BestMovesPayload {
        best_lines: Vec::new(),
        engine,
        tab,
    };

    send_command(&mut stdin, format!("position fen {}\n", &fen)).await;
    send_command(
        &mut stdin,
        format!("setoption name Threads value {}\n", options.threads),
    )
    .await;
    send_command(
        &mut stdin,
        format!("setoption name MultiPV value {}\n", options.multipv),
    )
    .await;
    send_command(&mut stdin, format!("go depth {}\n", options.depth)).await;

    loop {
        tokio::select! {
            _ = rx.recv() => {
                info!("Killing engine");
                send_command(&mut stdin, "stop\n").await;
                app.unlisten(id);
                break
            }
            result = stdout.next_line() => {
                match result {
                    Ok(line_opt) => {
                        if let Some(line) = line_opt {
                            if let UciMessage::Info(attrs) = parse_one(&line) {
                                if let Ok(best_moves) = parse_uci_attrs(attrs, &parsed_fen) {
                                    let multipv = best_moves.multipv;
                                    let cur_depth = best_moves.depth;
                                    best_moves_payload.best_lines.push(best_moves);
                                    if multipv == options.multipv {
                                        if best_moves_payload.best_lines.iter().all(|x| x.depth == cur_depth) && cur_depth >= last_depth {
                                            app.emit_all("best_moves", &best_moves_payload)?;
                                            state.analysis_cache.insert(key.clone(), best_moves_payload.best_lines.clone());
                                            last_depth = cur_depth;
                                        }
                                        best_moves_payload.best_lines.clear();
                                    }
                                }
                            }
                        }
                    }
                    Err(err) => {
                        error!("engine read error {:?}", err);
                        break;
                    }
                }
            }
        }
    }
    Ok(())
}

#[derive(Serialize, Debug, Default)]
pub struct MoveAnalysis {
    best: BestMoves,
    novelty: bool,
}

#[tauri::command]
pub async fn analyze_game(
    moves: String,
    annotate_novelties: bool,
    engine: String,
    move_time: usize,
    reference_db: Option<PathBuf>,
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<Vec<MoveAnalysis>, Error> {
    let path = PathBuf::from(&engine);
    let number_lines = 1;
    let number_threads = 4;
    let mut analysis: Vec<MoveAnalysis> = Vec::new();

    let mut child = start_engine(path)?;
    let (mut stdin, mut stdout) = get_handles(&mut child)?;

    let mut chess = Chess::default();

    send_command(
        &mut stdin,
        format!("setoption name Threads value {}\n", &number_threads),
    )
    .await;
    send_command(
        &mut stdin,
        format!("setoption name multipv value {}\n", &number_lines),
    )
    .await;

    let splitted_moves: Vec<&str> = moves.split_whitespace().collect();
    let len_moves = splitted_moves.len();

    let mut novelty_found = false;

    for (i, m) in splitted_moves.iter().enumerate() {
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

        send_command(&mut stdin, format!("position fen {}\n", &fen)).await;
        send_command(&mut stdin, format!("go movetime {}\n", &move_time)).await;

        let mut current_analysis = MoveAnalysis::default();
        while let Ok(Some(line)) = stdout.next_line().await {
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

        if annotate_novelties && !novelty_found {
            if let Some(reference) = reference_db.clone() {
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
    difficulty: usize,
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
    let depth = 8 + difficulty;

    let mut child = start_engine(path)?;
    let (mut stdin, mut stdout) = get_handles(&mut child)?;

    send_command(&mut stdin, format!("position fen {}\n", &fen)).await;
    send_command(
        &mut stdin,
        format!("setoption name Skill Level value {}\n", &difficulty),
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
            if line.starts_with("id name") {
                let name = &line[8..];
                return Ok(name.to_string());
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
