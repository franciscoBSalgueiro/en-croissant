use std::{fs::create_dir_all, io::Cursor, path::Path};

use reqwest::Client;

use futures_util::StreamExt;
use tauri::Manager;

#[derive(Clone, serde::Serialize)]
pub struct DownloadFilePayload {
    progress: f64,
    id: u64,
    finished: bool,
}

#[tauri::command]
pub async fn download_file(
    id: u64,
    url: String,
    path: String,
    zip: bool,
    app: tauri::AppHandle,
) -> Result<String, String> {
    println!("Downloading file from {}", url);
    let client = Client::new();
    let res = client
        .get(&url)
        .send()
        .await
        .map_err(|_| format!("Failed to GET from '{}'", &url))?;
    let total_size = res.content_length();

    let mut file: Vec<u8> = Vec::new();
    let mut downloaded: u64 = 0;
    let mut stream = res.bytes_stream();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|_| format!("Failed to get chunk from '{}'", &url))?;
        file.extend_from_slice(&chunk);
        downloaded += chunk.len() as u64;
        println!("Downloaded {} bytes", downloaded);
        if let Some(total_size) = total_size {
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
    }

    let path = Path::new(&path);

    println!("Downloaded file to {}", path.display());

    if zip {
        unzip_file(path, file).await;
    } else {
        std::fs::write(path, file).unwrap();
    }
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

pub async fn unzip_file(path: &Path, file: Vec<u8>) {
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
pub fn file_exists(path: String) -> bool {
    Path::new(&path).exists()
}
