use std::{
    path::PathBuf,
    process::Stdio,
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};

use shakmaty::{fen::Fen, san::San, uci::Uci, CastlingMode, Chess, Color, EnPassantMode, Position};
use tauri::{
    api::path::{resolve_path, BaseDirectory},
    Manager,
};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::Command,
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

#[derive(Clone, serde::Serialize, Debug)]
pub struct BestMovePayload {
    engine: String,
    depth: usize,
    score: Score,
    #[serde(rename = "sanMoves")]
    san_moves: Vec<String>,
    #[serde(rename = "uciMoves")]
    uci_moves: Vec<String>,
    multipv: usize,
    nps: usize,
}

impl Default for BestMovePayload {
    fn default() -> Self {
        BestMovePayload {
            engine: String::new(),
            depth: 0,
            score: Score::Cp(0),
            san_moves: Vec::new(),
            uci_moves: Vec::new(),
            multipv: 0,
            nps: 0,
        }
    }
}

pub fn parse_uci(
    info: &str,
    fen: &str,
    engine: &str,
) -> Result<BestMovePayload, Box<dyn std::error::Error>> {
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
    let mut san_moves = Vec::new();
    let uci_moves: Vec<String> = pv.split_whitespace().map(|x| x.to_string()).collect();

    let fen: Fen = fen.parse()?;
    let mut pos: Chess = match fen.into_position(CastlingMode::Standard) {
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
        pos.play_unchecked(&m);
        let san = San::from_move(&pos, &m);
        san_moves.push(san.to_string());
    }
    Ok(BestMovePayload {
        depth,
        score,
        san_moves,
        uci_moves,
        multipv,
        engine: engine.to_string(),
        nps,
    })
}

#[tauri::command]
pub async fn get_best_moves(
    engine: String,
    fen: String,
    depth: usize,
    number_lines: usize,
    number_threads: usize,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let path = PathBuf::from(&engine);

    // start engine command
    println!("RUNNING ENGINE");
    println!("{}", &path.display());
    println!("{}", &fen);

    assert!(number_lines > 0 && number_lines < 6);

    let mut command = Command::new(&path);
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    let mut child = command
        // .kill_on_drop(true)
        .spawn()
        .expect("Failed to start engine");

    let stdin = child
        .stdin
        .take()
        .expect("child did not have a handle to stdin");
    let stdout = child
        .stdout
        .take()
        .expect("child did not have a handle to stdout");
    let mut stdout_reader = BufReader::new(stdout).lines();

    let (tx, mut rx) = tokio::sync::broadcast::channel(16);

    let eng_id = engine.clone();
    let id = app.listen_global("stop_engine", move |event| {
        let payload = event.payload().unwrap();
        let payload = payload[1..payload.len() - 1].replace("\\\\", "\\");
        if payload == eng_id {
            let tx = tx.clone();
            tokio::spawn(async move {
                tx.send(()).unwrap();
            });
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

    let mut engine_lines = Vec::new();

    // tokio::spawn(async move {
    //     println!("Starting engine");
    //     let mut stdin = stdin;
    //     let write_result = stdin.write_all(b"go\n").await;
    //     if let Err(e) = write_result {
    //         println!("Error writing to stdin: {}", e);
    //     }
    // });

    tokio::spawn(async move {
        let mut stdin = stdin;
        stdin
            .write_all(format!("position fen {}\n", &fen).as_bytes())
            .await
            .expect("Failed to write position");
        stdin
            .write_all(format!("setoption name Threads value {}\n", &number_threads).as_bytes())
            .await
            .expect("Failed to write setoption");
        stdin
            .write_all(format!("setoption name multipv value {}\n", &number_lines).as_bytes())
            .await
            .expect("Failed to write setoption");
        stdin
            .write_all(format!("go depth {}\n", &depth).as_bytes())
            .await
            .expect("Failed to write go");

        let mut last_sent_ms = 0;
        let mut now_ms;
        loop {
            tokio::select! {
                _ = rx.recv() => {
                    println!("Killing engine");
                    stdin.write_all(b"stop\n").await.unwrap();
                    app.unlisten(id);
                    break
                }
                result = stdout_reader.next_line() => {
                    match result {
                        Ok(line_opt) => {
                            if let Some(line) = line_opt {
                                if line == "readyok" {
                                    println!("Engine ready");
                                }
                                if line.starts_with("info") && line.contains("pv") {
                                    if let Ok(best_moves) = parse_uci(&line, &fen, &engine) {
                                        let multipv = best_moves.multipv;
                                        let depth = best_moves.depth;
                                        engine_lines.push(best_moves);
                                        if multipv == number_lines {
                                            if depth >= 10 && engine_lines.iter().all(|x| x.depth == depth) {
                                                let now = SystemTime::now();
                                                now_ms = now.duration_since(UNIX_EPOCH).unwrap().as_millis();

                                                if now_ms - last_sent_ms > 300 {
                                                    app.emit_all("best_moves", &engine_lines).unwrap();
                                                    last_sent_ms = now_ms;
                                                }
                                            }
                                            engine_lines.clear();
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
    });
    Ok(())
}

#[tauri::command]
pub async fn analyze_game(
    moves: String,
    engine: String,
    move_time: usize,
    app: tauri::AppHandle,
) -> Result<Vec<BestMovePayload>, String> {
    println!("ANALYZING GAME");
    println!("{}", &moves);
    let moves_list: Vec<String> = moves.split(' ').map(|x| x.to_string()).collect();
    let mut path = PathBuf::from(&engine);
    let number_lines = 1;
    let number_threads = 4;
    let evals: Arc<Mutex<Vec<BestMovePayload>>> = Arc::new(Mutex::new(Vec::new()));
    let evals_clone = evals.clone();

    path = resolve_path(
        &app.config(),
        app.package_info(),
        &app.env(),
        path,
        Some(BaseDirectory::AppData),
    )
    .or(Err("Engine file doesn't exists"))?;
    // start engine command
    println!("RUNNING ENGINE");
    println!("{}", &path.display());

    let mut command = Command::new(&path);
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    let mut child = command
        // .kill_on_drop(true)
        .spawn()
        .expect("Failed to start engine");

    let stdin = child
        .stdin
        .take()
        .expect("child did not have a handle to stdin");
    let stdout = child
        .stdout
        .take()
        .expect("child did not have a handle to stdout");
    let mut stdout_reader = BufReader::new(stdout).lines();

    tokio::spawn(async move {
        // run engine process and wait for exit code
        let status = child
            .wait()
            .await
            .expect("engine process encountered an error");
        println!("engine process exit status : {}", status);
    });

    tokio::spawn(async move {
        let mut stdin = stdin;
        let mut chess = Chess::default();

        stdin
            .write_all(format!("setoption name Threads value {}\n", &number_threads).as_bytes())
            .await
            .expect("Failed to write setoption");
        stdin
            .write_all(format!("setoption name multipv value {}\n", &number_lines).as_bytes())
            .await
            .expect("Failed to write setoption");

        for m in moves_list {
            let san = San::from_ascii(m.as_bytes()).unwrap();
            let m = san.to_move(&chess).unwrap();
            chess.play_unchecked(&m);
            let fen = Fen::from_position(chess.clone(), EnPassantMode::Legal);

            stdin
                .write_all(format!("position fen {}\n", &fen).as_bytes())
                .await
                .expect("Failed to write position");
            stdin
                .write_all(format!("go movetime {}\n", &move_time * 1000).as_bytes())
                .await
                .expect("Failed to write go");
            let mut current_payload = BestMovePayload::default();
            loop {
                tokio::select! {
                    result = stdout_reader.next_line() => {
                        match result {
                            Ok(line_opt) => {
                                if let Some(line) = line_opt {
                                    if line == "readyok" {
                                        println!("Engine ready");
                                    }
                                    if line.starts_with("bestmove") {
                                        println!("bestmove");
                                        break;
                                    }
                                    if line.starts_with("info") && line.contains("pv") {
                                        if let Ok(best_moves) = parse_uci(&line, &fen.to_string(), &engine) {
                                            current_payload = best_moves;
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
            evals_clone.lock().unwrap().push(current_payload);
        }
    }).await.unwrap();
    let final_evals = evals.lock().unwrap().clone();
    Ok(final_evals)
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

    // start engine command
    println!("RUNNING ENGINE");
    println!("{}", &path.display());

    let mut command = Command::new(&path);
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    let mut child = command
        // .kill_on_drop(true)
        .spawn()
        .expect("Failed to start engine");

    let stdin = child
        .stdin
        .take()
        .expect("child did not have a handle to stdin");
    let stdout = child
        .stdout
        .take()
        .expect("child did not have a handle to stdout");
    let mut stdout_reader = BufReader::new(stdout).lines();

    let mut stdin = stdin;
    stdin
        .write_all(format!("position fen {}\n", &fen).as_bytes())
        .await
        .expect("Failed to write position");
    stdin
        .write_all(format!("setoption name Skill Level value {}\n", &difficulty).as_bytes())
        .await
        .expect("Failed to write setoption");
    stdin
        .write_all(format!("setoption name Threads value {}\n", &number_threads).as_bytes())
        .await
        .expect("Failed to write setoption");
    stdin
        .write_all(format!("go depth {}\n", &depth).as_bytes())
        .await
        .expect("Failed to write go");

    loop {
        let result = stdout_reader.next_line().await;
        match result {
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
