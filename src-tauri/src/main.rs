#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::fs::write;

use tauri::api::http;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .invoke_handler(tauri::generate_handler![download_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
async fn download_file(url: String, path: String) -> Result<String, String> {
    println!("Downloading file from {}", url);
    let client = http::ClientBuilder::new().build().unwrap();
    let request = http::HttpRequestBuilder::new("GET", &url).unwrap();
    // get the file
    let response = client.send(request).await.unwrap();
    // get the file
    let file = response.bytes().await.unwrap().data;
    write(&path, file).unwrap();
    println!("File downloaded");
    println!("Unzipping file");
    let mut archive = zip::ZipArchive::new(std::fs::File::open(&path).unwrap()).unwrap();
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).unwrap();
        let outpath = file.sanitized_name();
        if (&*file.name()).ends_with('/') {
            std::fs::create_dir_all(&outpath).unwrap();
        } else {
            std::fs::create_dir_all(&outpath.parent().unwrap()).unwrap();
            let mut outfile = std::fs::File::create(&outpath).unwrap();
            std::io::copy(&mut file, &mut outfile).unwrap();
        }
    }
    println!("File unzipped");
    Ok("downloaded_file".to_string())
}
