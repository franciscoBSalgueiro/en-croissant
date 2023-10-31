use std::{
    fs::create_dir_all,
    io::{Cursor, Write},
    path::{Path, PathBuf},
};

use log::info;
use reqwest::{header::HeaderMap, Client};
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use futures_util::StreamExt;
use tauri::Manager;

use crate::error::Error;

#[derive(Clone, serde::Serialize)]
pub struct ProgressPayload {
    pub progress: f64,
    pub id: u64,
    pub finished: bool,
}

#[tauri::command]
pub async fn download_file(
    id: u64,
    url: String,
    path: PathBuf,
    app: tauri::AppHandle,
    token: Option<String>,
    finalize: Option<bool>,
) -> Result<(), Error> {
    let finalize = finalize.unwrap_or(true);
    info!("Downloading file from {}", url);
    let client = Client::new();

    let mut req = client.get(&url);
    // add Bearer if token is present
    if let Some(token) = token {
        let mut header_map = HeaderMap::new();
        header_map.insert("Authorization", format!("Bearer {token}").parse().unwrap());
        req = req.headers(header_map);
    }
    let res = req.send().await?;
    let total_size = res.content_length();

    let mut file: Vec<u8> = Vec::new();
    let mut downloaded: u64 = 0;
    let mut stream = res.bytes_stream();

    while let Some(item) = stream.next().await {
        let chunk = item?;
        file.extend_from_slice(&chunk);
        downloaded += chunk.len() as u64;
        if let Some(total_size) = total_size {
            let progress = (downloaded as f64 / total_size as f64) * 100.0;
            // println!("Downloaded {}%", progress);
            app.emit_all(
                "download_progress",
                ProgressPayload {
                    progress,
                    id,
                    finished: false,
                },
            )?;
        }
    }

    let path = Path::new(&path);

    info!("Downloaded file to {}", path.display());

    if url.ends_with(".zip") {
        unzip_file(path, file).await?;
    } else if url.ends_with(".tar") {
        let mut archive = tar::Archive::new(Cursor::new(file));
        archive.unpack(path)?;
    } else {
        std::fs::write(path, file)?
    }

    if finalize {
        app.emit_all(
            "download_progress",
            ProgressPayload {
                progress: 100.0,
                id,
                finished: true,
            },
        )?;
    }
    // remove_file(&path).await;
    Ok(())
}

pub async fn unzip_file(path: &Path, file: Vec<u8>) -> Result<(), Error> {
    let mut archive = zip::ZipArchive::new(Cursor::new(file))?;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let outpath = path.join(file.mangled_name());
        if (*file.name()).ends_with('/') {
            info!(
                "File {} extracted to \"{}\"",
                i,
                outpath.as_path().display()
            );
            create_dir_all(&outpath)?;
        } else {
            info!(
                "File {} extracted to \"{}\" ({} bytes)",
                i,
                outpath.as_path().display(),
                file.size()
            );
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    create_dir_all(p)?;
                }
            }
            let mut outfile = std::fs::File::create(&outpath)?;
            std::io::copy(&mut file, &mut outfile)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn set_file_as_executable(_path: String) -> Result<(), Error> {
    #[cfg(unix)]
    {
        let path = Path::new(&_path);
        let metadata = std::fs::metadata(path)?;
        let mut permissions = metadata.permissions();
        permissions.set_mode(0o755);
        std::fs::set_permissions(path, permissions)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn append_to_file(path: String, text: String) -> Result<(), Error> {
    let mut file = std::fs::OpenOptions::new().append(true).open(path)?;
    file.write_all(text.as_bytes())?;
    Ok(())
}
