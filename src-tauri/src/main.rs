#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::{
    fs::{create_dir_all},
    io::Cursor,
    path::Path,
};

use tauri::{
    api::{
        http,
    },
};

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .invoke_handler(tauri::generate_handler![download_file])
        .invoke_handler(tauri::generate_handler![list_folders])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
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
            println!("File {} extracted to \"{}\"", i, outpath.as_path().display());
            create_dir_all(&outpath).unwrap();
        } else {
            println!("File {} extracted to \"{}\" ({} bytes)", i, outpath.as_path().display(), file.size());
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
