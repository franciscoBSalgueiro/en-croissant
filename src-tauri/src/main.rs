#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

use std::{
    fs::create_dir_all,
    io::Cursor,
    path::{Path, PathBuf},
    process::Stdio,
    time::{SystemTime, UNIX_EPOCH},
};

use futures_util::StreamExt;
use shakmaty::{fen::Fen, san::San, uci::Uci, CastlingMode, Chess, Color, Position};
use tauri::{
    api::path::{resolve_path, BaseDirectory},
    Manager,
};

use reqwest::Client;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::Command,
};

#[derive(Debug, serde::Serialize, Copy, Clone)]
pub enum Score {
    #[serde(rename = "cp")]
    Cp(i64),
    #[serde(rename = "mate")]
    Mate(i64),
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Check if the directory exists, if not, create it
            let path = resolve_path(
                &app.config(),
                app.package_info(),
                &app.env(),
                "engines",
                Some(BaseDirectory::AppData),
            )
            .unwrap();
            if !Path::new(&path).exists() {
                create_dir_all(&path).unwrap();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            download_file,
            list_folders,
            file_exists,
            remove_folder,
            get_best_moves
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[derive(Clone, serde::Serialize)]
struct DownloadFilePayload {
    progress: f64,
    id: u64,
    finished: bool,
}

#[tauri::command]
async fn download_file(
    id: u64,
    url: String,
    path: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    println!("Downloading file from {}", url);
    let client = Client::new();
    let res = client
        .get(&url)
        .send()
        .await
        .map_err(|_| format!("Failed to GET from '{}'", &url))?;
    let total_size = res
        .content_length()
        .ok_or(format!("Failed to get content length from '{}'", &url))?;

    let mut file: Vec<u8> = Vec::new();
    let mut downloaded: u64 = 0;
    let mut stream = res.bytes_stream();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|_| format!("Failed to get chunk from '{}'", &url))?;
        file.extend_from_slice(&chunk);
        downloaded += chunk.len() as u64;
        let progress = (downloaded as f64 / total_size as f64) * 100.0;
        println!("Downloaded {}%", progress);
        // emit object with progress and id
        app.emit_all(
            "download_progress",
            DownloadFilePayload {
                progress,
                id,
                finished: false,
            },
        )
        .unwrap();
    }

    let path = Path::new(&path);

    // let client = http::ClientBuilder::new().build().unwrap();
    // let request = http::HttpRequestBuilder::new("GET", &url).unwrap();
    // let response = client.send(request).await.unwrap();
    // let file = response.bytes().await.unwrap().data;
    // let path = Path::new(&path);
    // write(&path, &file).unwrap();
    unzip_file(path, file).await;
    app.emit_all(
        "download_progress",
        DownloadFilePayload {
            progress: 100.0,
            id,
            finished: true,
        },
    )
    .unwrap();
    // remove_file(&path).await;
    Ok("downloaded_file".to_string())
}

async fn unzip_file(path: &Path, file: Vec<u8>) {
    let mut archive = zip::ZipArchive::new(Cursor::new(file)).unwrap();
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).unwrap();
        let outpath = path.join(file.mangled_name());
        if (*file.name()).ends_with('/') {
            println!(
                "File {} extracted to \"{}\"",
                i,
                outpath.as_path().display()
            );
            create_dir_all(&outpath).unwrap();
        } else {
            println!(
                "File {} extracted to \"{}\" ({} bytes)",
                i,
                outpath.as_path().display(),
                file.size()
            );
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    create_dir_all(p).unwrap();
                }
            }
            let mut outfile = std::fs::File::create(&outpath).unwrap();
            std::io::copy(&mut file, &mut outfile).unwrap();
        }
    }
}

#[tauri::command]
fn file_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
async fn list_folders(directory: String) -> Result<String, String> {
    let path = Path::new(&directory);
    let mut folders = Vec::new();
    if path.is_dir() {
        for entry in std::fs::read_dir(path).unwrap() {
            let entry = entry.unwrap();
            let path = entry.path();
            if path.is_dir() {
                folders.push(path.file_name().unwrap().to_str().unwrap().to_string());
            }
        }
    }
    Ok(folders.join(","))
}

#[tauri::command]
async fn remove_folder(directory: String) -> Result<String, String> {
    let path = Path::new(&directory);
    if path.is_dir() {
        std::fs::remove_dir_all(path).unwrap();
    }
    Ok("removed".to_string())
}

#[derive(Clone, serde::Serialize, Debug)]
struct BestMovePayload {
    depth: usize,
    score: Score,
    #[serde(rename = "sanMoves")]
    san_moves: Vec<String>,
    #[serde(rename = "uciMoves")]
    uci_moves: Vec<String>,
    multipv: usize,
}

#[tauri::command]
async fn get_best_moves(
    engine: String,
    relative: bool,
    fen: String,
    depth: usize,
    number_lines: usize,
    number_threads: usize,
    app: tauri::AppHandle,
) {
    let mut path = PathBuf::from(engine);
    if relative {
        path = resolve_path(
            &app.config(),
            app.package_info(),
            &app.env(),
            path,
            Some(BaseDirectory::AppData),
        )
        .unwrap();
    }
    // start engine command
    println!("{}", &fen);

    // Check number of lines is between 1 and 5
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

    let id = app.listen_global("stop_engine", move |_| {
        let tx = tx.clone();
        tokio::spawn(async move {
            tx.send(()).unwrap();
        });
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
                                    let best_moves = parse_uci(&line, &fen).unwrap();
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
                        Err(err) => {
                            println!("engine read error {:?}", err);
                            break;
                        }
                    }
                }
            }
        }
    });
}

fn parse_uci(info: &str, fen: &str) -> Option<BestMovePayload> {
    let mut depth = 0;
    let mut score = Score::Cp(0);
    let mut pv = String::new();
    let mut multipv = 0;
    // example input: info depth 1 seldepth 1 multipv 1 score cp 0 nodes 20 nps 10000 tbhits 0 time 2 pv e2e4
    for (i, s) in info.split_whitespace().enumerate() {
        match s {
            "depth" => depth = info.split_whitespace().nth(i + 1).unwrap().parse().unwrap(),
            "score" => {
                if info.split_whitespace().nth(i + 1).unwrap() == "cp" {
                    score = Score::Cp(info.split_whitespace().nth(i + 2).unwrap().parse().unwrap());
                } else {
                    score =
                        Score::Mate(info.split_whitespace().nth(i + 2).unwrap().parse().unwrap());
                }
            }
            "pv" => {
                pv = info
                    .split_whitespace()
                    .skip(i + 1)
                    .take_while(|x| !x.starts_with("currmove"))
                    .collect::<Vec<&str>>()
                    .join(" ");
            }
            "multipv" => {
                multipv = info.split_whitespace().nth(i + 1).unwrap().parse().unwrap();
            }
            _ => (),
        }
    }
    let mut san_moves = Vec::new();
    let uci_moves: Vec<String> = pv.split_whitespace().map(|x| x.to_string()).collect();

    let fen: Fen = fen.parse().unwrap();
    let mut pos: Chess = fen.into_position(CastlingMode::Standard).unwrap();
    if pos.turn() == Color::Black {
        score = match score {
            Score::Cp(x) => Score::Cp(-x),
            Score::Mate(x) => Score::Mate(-x),
        };
    }
    for m in &uci_moves {
        let uci: Uci = m.parse().unwrap();
        let m = uci.to_move(&pos).unwrap();
        pos.play_unchecked(&m);
        let san = San::from_move(&pos, &m);
        san_moves.push(san.to_string());
    }
    Some(BestMovePayload {
        depth,
        score,
        san_moves,
        uci_moves,
        multipv,
    })
}
