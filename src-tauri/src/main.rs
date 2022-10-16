#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::{fs::create_dir_all, io::Cursor, path::Path};

use futures_util::StreamExt;
use tauri::Manager;
use uciengine::uciengine::GoJob;
use uciengine::uciengine::UciEngine;

use reqwest::Client;

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
struct Payload {
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
        app.emit_all("download_progress", Payload { progress, id })
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

#[tauri::command]
async fn get_best_moves(engine: String, app: tauri::AppHandle) -> Result<String, String> {
    let go_job = GoJob::new()
        .uci_opt("UCI_Variant", "chess")
        .pos_startpos()
        .go_opt("depth", 21);
    let engine = UciEngine::new(engine);

    let go_result = engine.go(go_job).await;
    let best_move = go_result.unwrap().bestmove.unwrap();
    app.emit_all("best_move", &best_move).unwrap();
    Ok(best_move)
}
