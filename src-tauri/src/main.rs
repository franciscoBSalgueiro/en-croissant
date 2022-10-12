#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::{fs::create_dir_all, io::Cursor, path::Path};

use tauri::api::http;

use tauri::Manager;
use tokio::sync::mpsc;
use tokio::sync::Mutex;
use tracing::info;
use tracing_subscriber;
use uciengine::uciengine::GoJob;
use uciengine::uciengine::UciEngine;

struct AsyncProcInputTx {
    inner: Mutex<mpsc::Sender<String>>,
}

fn main() {
    tracing_subscriber::fmt::init();

    let (async_proc_input_tx, async_proc_input_rx) = mpsc::channel(1);
    let (async_proc_output_tx, mut async_proc_output_rx) = mpsc::channel(1);

    tauri::Builder::default()
        .manage(AsyncProcInputTx {
            inner: Mutex::new(async_proc_input_tx),
        })
        .invoke_handler(tauri::generate_handler![download_file, list_folders, js2rs])
        .setup(|app| {
            tauri::async_runtime::spawn(async move {
                async_process_model(async_proc_input_rx, async_proc_output_tx).await
            });

            let app_handle = app.handle();
            tauri::async_runtime::spawn(async move {
                loop {
                    if let Some(output) = async_proc_output_rx.recv().await {
                        rs2js(output, &app_handle).await;
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

async fn rs2js<R: tauri::Runtime>(message: String, manager: &impl Manager<R>) {
    let bestmove = getBestMoves().await;
    info!(?message, "rs2js");
    manager
        .emit_all("rs2js", format!("rs: {}", bestmove.unwrap()))
        .unwrap();
}

#[tauri::command]
async fn js2rs(message: String, state: tauri::State<'_, AsyncProcInputTx>) -> Result<(), String> {
    info!(?message, "js2rs");
    let async_proc_input_tx = state.inner.lock().await;
    async_proc_input_tx
        .send(message)
        .await
        .map_err(|e| e.to_string())
}

async fn async_process_model(
    mut input_rx: mpsc::Receiver<String>,
    output_tx: mpsc::Sender<String>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    while let Some(input) = input_rx.recv().await {
        let output = input;
        output_tx.send(output).await?;
    }

    Ok(())
}

#[tauri::command]
async fn download_file(url: String, path: String) -> Result<String, String> {
    println!("Downloading file from {}", url);
    let client = http::ClientBuilder::new().build().unwrap();
    let request = http::HttpRequestBuilder::new("GET", &url).unwrap();
    let response = client.send(request).await.unwrap();
    let file = response.bytes().await.unwrap().data;
    let path = Path::new(&path);
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

// async fn remove_file(path: &String) {
//     println!("Removing file {}", path);
//     std::fs::remove_file(path).unwrap();
//     println!("File removed");
// }

async fn getBestMoves() -> Result<String, String> {
    let go_job = GoJob::new()
        .uci_opt("UCI_Variant", "chess")
        .pos_startpos()
        .go_opt("depth", 21);
    let engine = UciEngine::new("./engines/stockfish_15_win_x64_avx2/stockfish_15_x64_avx2.exe");

    let go_result = engine.go(go_job).await;
    let best_move = go_result.unwrap().bestmove.unwrap();
    Ok(best_move)
}
