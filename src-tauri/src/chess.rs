use std::{path::PathBuf, process::Stdio};

use derivative::Derivative;
use rand::seq::SliceRandom;
use serde::Serialize;
use shakmaty::{
    fen::Fen, san::San, san::SanPlus, uci::Uci, CastlingMode, Chess, Color, EnPassantMode, Piece,
    Position, Role, Setup, Square,
};
use tauri::{
    api::path::{resolve_path, BaseDirectory},
    Manager,
};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader, Lines},
    process::{Child, ChildStdin, ChildStdout, Command},
};

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, serde::Serialize, Copy, Clone)]
pub enum Score {
    #[serde(rename = "cp")]
    Cp(i64),
    #[serde(rename = "mate")]
    Mate(i64),
}

#[derive(Clone, Serialize, Debug, Derivative)]
#[derivative(Default)]
pub struct BestMoves {
    depth: usize,
    #[derivative(Default(value = "Score::Cp(0)"))]
    score: Score,
    #[serde(rename = "uciMoves")]
    uci_moves: Vec<String>,
    #[serde(rename = "sanMoves")]
    san_moves: Vec<String>,
    multipv: usize,
    nps: usize,
}

#[derive(Serialize, Debug)]
pub struct BestMovesPayload {
    #[serde(rename = "bestLines")]
    pub best_lines: Vec<BestMoves>,
    pub engine: String,
    pub tab: String,
}

fn parse_uci(info: &str, fen: &Fen) -> Result<BestMoves, Box<dyn std::error::Error>> {
    let mut depth = 0;
    let mut score = Score::Cp(0);
    let mut pv = String::new();
    let mut multipv = 0;
    let mut nps = 0;
    // example input: info depth 1 seldepth 1 multipv 1 score cp 0 nodes 20 nps 10000 tbhits 0 time 2 pv e2e4
    for (i, s) in info.split_whitespace().enumerate() {
        match s {
            "depth" => depth = info.split_whitespace().nth(i + 1).unwrap().parse()?,
            "score" => {
                if info.split_whitespace().nth(i + 1).unwrap() == "cp" {
                    score = Score::Cp(info.split_whitespace().nth(i + 2).unwrap().parse()?);
                } else {
                    score = Score::Mate(info.split_whitespace().nth(i + 2).unwrap().parse()?);
                }
            }
            "nps" => nps = info.split_whitespace().nth(i + 1).unwrap().parse()?,
            "multipv" => {
                multipv = info.split_whitespace().nth(i + 1).unwrap().parse()?;
            }
            "pv" => {
                pv = info
                    .split_whitespace()
                    .skip(i + 1)
                    .take_while(|x| !x.starts_with("currmove"))
                    .collect::<Vec<&str>>()
                    .join(" ");
            }
            _ => (),
        }
    }
    let uci_moves: Vec<String> = pv.split_whitespace().map(|x| x.to_string()).collect();
    let mut san_moves = Vec::new();

    let mut pos: Chess = match fen.clone().into_position(CastlingMode::Standard) {
        Ok(p) => p,
        Err(e) => e.ignore_impossible_material().unwrap(),
    };
    if pos.turn() == Color::Black {
        score = match score {
            Score::Cp(x) => Score::Cp(-x),
            Score::Mate(x) => Score::Mate(-x),
        };
    }
    for m in &uci_moves {
        let uci: Uci = m.parse()?;
        let m = uci.to_move(&pos)?;
        let san = SanPlus::from_move_and_play_unchecked(&mut pos, &m);
        san_moves.push(san.to_string());
    }
    Ok(BestMoves {
        depth,
        score,
        uci_moves,
        san_moves,
        multipv,
        nps,
    })
}

fn start_engine(path: PathBuf) -> Result<Child, String> {
    let mut command = Command::new(&path);
    command.current_dir(path.parent().unwrap());
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    let child = command.spawn().expect("Failed to start engine");

    Ok(child)
}

fn get_handles(child: &mut Child) -> (ChildStdin, Lines<BufReader<ChildStdout>>) {
    let stdin = child
        .stdin
        .take()
        .expect("child did not have a handle to stdin");
    let stdout = child
        .stdout
        .take()
        .expect("child did not have a handle to stdout");
    let stdout = BufReader::new(stdout).lines();
    (stdin, stdout)
}

async fn send_command(stdin: &mut ChildStdin, command: impl AsRef<str>) {
    stdin
        .write_all(command.as_ref().as_bytes())
        .await
        .expect("Failed to write command");
}

#[tauri::command]
pub async fn get_best_moves(
    engine: String,
    tab: String,
    fen: String,
    depth: usize,
    number_lines: usize,
    number_threads: usize,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let path = PathBuf::from(&engine);
    let mut child = start_engine(path)?;
    let (mut stdin, mut stdout) = get_handles(&mut child);

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
        println!("engine process exit status : {}", status);
    });

    let mut best_moves_payload = BestMovesPayload {
        best_lines: Vec::new(),
        engine,
        tab,
    };

    send_command(&mut stdin, format!("position fen {}\n", &fen)).await;
    send_command(
        &mut stdin,
        format!("setoption name Threads value {}\n", &number_threads),
    )
    .await;
    send_command(
        &mut stdin,
        format!("setoption name MultiPV value {}\n", &number_lines),
    )
    .await;
    send_command(&mut stdin, format!("go depth {}\n", &depth)).await;

    let fen: Fen = fen.parse().or(Err("Invalid fen"))?;
    loop {
        tokio::select! {
            _ = rx.recv() => {
                println!("Killing engine");
                send_command(&mut stdin, "stop\n").await;
                app.unlisten(id);
                break
            }
            result = stdout.next_line() => {
                match result {
                    Ok(line_opt) => {
                        if let Some(line) = line_opt {
                            if line.starts_with("info") && line.contains("pv") {
                                if let Ok(best_moves) = parse_uci(&line, &fen) {
                                    let multipv = best_moves.multipv;
                                    let cur_depth = best_moves.depth;
                                    best_moves_payload.best_lines.push(best_moves);
                                    if multipv == number_lines {
                                        if best_moves_payload.best_lines.iter().all(|x| x.depth == cur_depth) {
                                            app.emit_all("best_moves", &best_moves_payload).unwrap();
                                        }
                                        best_moves_payload.best_lines.clear();
                                    }
                                }
                            }
                        }
                    }
                    Err(err) => {
                        println!("engine read error {:?}", err);
                        break;
                    }
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn analyze_game(
    moves: String,
    engine: String,
    move_time: usize,
) -> Result<Vec<BestMoves>, String> {
    let path = PathBuf::from(&engine);
    let number_lines = 1;
    let number_threads = 4;
    let mut evals: Vec<BestMoves> = Vec::new();

    let mut child = start_engine(path)?;
    let (mut stdin, mut stdout) = get_handles(&mut child);

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

    for m in moves.split_whitespace() {
        let san = San::from_ascii(m.as_bytes()).unwrap();
        let m = san.to_move(&chess).unwrap();
        chess.play_unchecked(&m);
        let fen = Fen::from_position(chess.clone(), EnPassantMode::Legal);

        send_command(&mut stdin, format!("position fen {}\n", &fen)).await;
        send_command(&mut stdin, format!("go movetime {}\n", &move_time * 1000)).await;

        let mut current_payload = BestMoves::default();
        while let Ok(Some(line)) = stdout.next_line().await {
            if line.starts_with("bestmove") {
                break;
            }
            if line.starts_with("info") && line.contains("pv") {
                if let Ok(best_moves) = parse_uci(&line, &fen) {
                    current_payload = best_moves;
                }
            }
        }
        evals.push(current_payload);
    }
    Ok(evals)
}

#[tauri::command]
pub async fn get_single_best_move(
    difficulty: usize,
    fen: String,
    engine: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let mut path = PathBuf::from(&engine);
    path = resolve_path(
        &app.config(),
        app.package_info(),
        &app.env(),
        path,
        Some(BaseDirectory::AppData),
    )
    .or(Err("Engine file doesn't exists"))?;
    let number_threads = 4;
    let depth = 8 + difficulty;

    let mut child = start_engine(path)?;
    let (mut stdin, mut stdout) = get_handles(&mut child);

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
        match stdout.next_line().await {
            Ok(line_opt) => {
                if let Some(line) = line_opt {
                    if line.starts_with("bestmove") {
                        let m = line.split_whitespace().nth(1).unwrap();
                        println!("bestmove {}", m);
                        return Ok(m.to_string());
                    }
                }
            }
            Err(err) => {
                return Err(format!("engine read error {:?}", err));
            }
        }
    }
}

#[tauri::command]
pub async fn get_engine_name(path: PathBuf) -> Result<String, String> {
    let mut child = start_engine(path)?;
    let (mut stdin, mut stdout) = get_handles(&mut child);

    send_command(&mut stdin, "uci\n").await;

    loop {
        match stdout.next_line().await {
            Ok(line_opt) => {
                if let Some(line) = line_opt {
                    if line.starts_with("id name") {
                        let name = &line[8..];
                        return Ok(name.to_string());
                    }
                }
            }
            Err(err) => {
                return Err(format!("engine read error {:?}", err));
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
    let fen = Fen::from_setup(pos);
    Ok(fen.to_string())
}

#[tauri::command]
pub fn make_random_move(fen: String) -> Result<String, String> {
    let fen: Fen = fen.parse().or(Err("Invalid fen"))?;
    let pos: Chess = fen.into_position(CastlingMode::Standard).unwrap();
    let legal_moves = pos.legal_moves();
    let mut rng = rand::thread_rng();
    let random_move = legal_moves.choose(&mut rng).ok_or("No legal moves")?;
    let uci = Uci::from_move(random_move, CastlingMode::Standard);
    Ok(uci.to_string())
}
