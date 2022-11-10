#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

use std::{fs::create_dir_all, io::Cursor, path::Path, process::Stdio};

use futures_util::StreamExt;
use tauri::Manager;

use reqwest::Client;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::Command,
};

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            download_file,
            list_folders,
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
        .or(Err(format!("Failed to GET from '{}'", &url)))?;
    let total_size = res
        .content_length()
        .ok_or(format!("Failed to get content length from '{}'", &url))?;

    let mut file: Vec<u8> = Vec::new();
    let mut downloaded: u64 = 0;
    let mut stream = res.bytes_stream();

    while let Some(item) = stream.next().await {
        let chunk = item.or(Err(format!("Failed to get chunk from '{}'", &url)))?;
        file.extend_from_slice(&chunk);
        downloaded += chunk.len() as u64;
        let progress = (downloaded as f64 / total_size as f64) * 100.0;
        println!("Downloaded {}%", progress);
        // emit object with progress and id
        app.emit_all("download_progress", DownloadFilePayload { progress, id })
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
    // remove_file(&path).await;
    Ok("downloaded_file".to_string())
}

async fn unzip_file(path: &Path, file: Vec<u8>) {
    let mut archive = zip::ZipArchive::new(Cursor::new(file)).unwrap();
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).unwrap();
        let outpath = path.join(file.mangled_name());
        if (&*file.name()).ends_with('/') {
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
                    create_dir_all(&p).unwrap();
                }
            }
            let mut outfile = std::fs::File::create(&outpath).unwrap();
            std::io::copy(&mut file, &mut outfile).unwrap();
        }
    }
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
    depth: u64,
    score: i64,
    pv: String,
}

#[tauri::command]
async fn get_best_moves(engine: String, fen: String, app: tauri::AppHandle) {
    // start engine command
    println!("{}", &fen);

    let mut command = Command::new(&engine);
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
        let res1 = stdin
            // .write_all(b"position fen rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1\n")
            .write_all(format!("position fen {}\n", &fen).as_bytes())
            .await;
        if let Err(e) = res1 {
            println!("Error writing to stdin: {}", e);
        }
        let res2 = stdin.write_all(b"go infinite\n").await;
        if let Err(e) = res2 {
            println!("Error writing to stdin: {}", e);
        }

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
                                println!("line: {:?}", parse_uci(&line));
                                app.emit_all("best_move", parse_uci(&line)).unwrap();
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

            // match rx.recv().await {
            //     Ok(_) => {
            //         println!("Stopping engine");
            //         stdin.write_all(b"stop\n").await.unwrap();
            //         app.unlisten(id);
            //         break;
            //     }
            //     Err(_) => {
            //         println!("Stopping engine");
            //         stdin.write_all(b"stop\n").await.unwrap();
            //         break;
            //     }
            // }
            // tokio::select! {
            //     // _ = rx.recv() => {
            //     //     println!("Killing engine");
            //     //     child.kill().await.unwrap();
            //     //     app.unlisten(id);
            //     //     break
            //     // }
            //     result = stdout_reader.next_line() => {
            //             match result {
            //                 Ok(Some(line)) => {
            //                 // println!("stdout: {}", &line);
            //                 if line.starts_with("info") && !line.contains("currmove") {
            //                     app.emit_all("best_move",
            //                     parseUCIInfo(&line)
            //                 ).unwrap();
            //             }

            //                 // if line.contains("uciok") {
            //                 //     // write to engine
            //                 //     // stdin.write_all(b"isready\n").await.unwrap();
            //                 //     println!("writing to engine");
            //                 //  }
            //             },
            //             Err(_) => break,
            //             _ => (),
            //         }
            //     }
            //     result = stderr_reader.next_line() => {
            //         match result {
            //             Ok(Some(line)) => println!("Stderr: {}", line),
            //             Err(_) => break,
            //             _ => (),
            //         }
            //     }
            // };
        }
    });
}

fn parse_uci(info: &str) -> Option<BestMovePayload> {
    let mut depth = 0;
    let mut score = 0;
    let mut pv = String::new();
    // example input: info depth 1 seldepth 1 multipv 1 score cp 0 nodes 20 nps 10000 tbhits 0 time 2 pv e2e4
    for (i, s) in info.split_whitespace().enumerate() {
        match s {
            "depth" => depth = info.split_whitespace().nth(i + 1).unwrap().parse().unwrap(),
            "score" => {
                score = info.split_whitespace().nth(i + 2).unwrap().parse().unwrap();
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
    Some(BestMovePayload { depth, score, pv })
}
