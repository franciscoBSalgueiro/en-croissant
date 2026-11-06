use std::{
    fs::create_dir_all,
    path::{Path, PathBuf},
};

use tokio::io::AsyncWriteExt;

use log::info;
use reqwest::{header::HeaderMap, Client};
use specta::Type;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use flate2::read::GzDecoder;
use futures_util::StreamExt;

use crate::error::Error;
use crate::progress::update_progress;
use crate::AppState;

#[tauri::command]
#[specta::specta]
pub async fn download_file(
    id: String,
    url: String,
    path: PathBuf,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    token: Option<String>,
    finalize: Option<bool>,
    total_size: Option<u32>,
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
    let res = req.send().await?.error_for_status()?;
    let total_size = if let Some(total_size) = total_size {
        Some(total_size as u64)
    } else {
        res.content_length()
    };

    // Stream straight to disk: databases can be several GB, far more than an
    // iPhone/iPad has RAM (keeping them in memory made large downloads fail).
    let path = Path::new(&path).to_path_buf();
    let temp_path = PathBuf::from(format!("{}.download", path.display()));
    if let Some(parent) = temp_path.parent() {
        create_dir_all(parent)?;
    }
    let result = async {
        let mut out = tokio::io::BufWriter::with_capacity(
            1 << 20,
            tokio::fs::File::create(&temp_path).await?,
        );
        let mut downloaded: u64 = 0;
        let mut stream = res.bytes_stream();
        let mut last_progress = -1.0f32;
        while let Some(item) = stream.next().await {
            let chunk = item?;
            out.write_all(&chunk).await?;
            downloaded += chunk.len() as u64;
            if let Some(total_size) = total_size {
                let progress = ((downloaded as f32 / total_size as f32) * 100.0).min(100.0);
                // Don't flood the UI with events for every network chunk.
                if progress - last_progress >= 0.1 {
                    last_progress = progress;
                    update_progress(&state.progress_state, &app, id.clone(), progress, false)?;
                }
            }
        }
        out.flush().await?;
        drop(out);

        info!("Downloaded file to {}", path.display());

        let kind = archive_kind(&url);
        let (dest, temp) = (path.clone(), temp_path.clone());
        tokio::task::spawn_blocking(move || -> Result<(), Error> {
            match kind {
                Some(ArchiveKind::Zip) => unzip_reader(&dest, std::fs::File::open(&temp)?)?,
                Some(ArchiveKind::Tar) => {
                    let mut archive = tar::Archive::new(std::io::BufReader::new(
                        std::fs::File::open(&temp)?,
                    ));
                    archive.unpack(&dest)?;
                }
                Some(ArchiveKind::TarGz) => {
                    let decoder =
                        GzDecoder::new(std::io::BufReader::new(std::fs::File::open(&temp)?));
                    let mut archive = tar::Archive::new(decoder);
                    archive.unpack(&dest)?;
                }
                None => std::fs::rename(&temp, &dest)?,
            }
            Ok(())
        })
        .await
        .map_err(|e| std::io::Error::other(e.to_string()))??;
        Ok::<(), Error>(())
    }
    .await;
    let _ = std::fs::remove_file(&temp_path);
    result?;

    if finalize {
        update_progress(&state.progress_state, &app, id, 100.0, true)?;
    }
    // remove_file(&path).await;
    Ok(())
}


#[derive(Debug, PartialEq)]
enum ArchiveKind {
    Zip,
    Tar,
    TarGz,
}

fn archive_kind(url: &str) -> Option<ArchiveKind> {
    let path = url.split(['?', '#']).next().unwrap_or(url);

    if path.ends_with(".tar.gz") {
        Some(ArchiveKind::TarGz)
    } else if path.ends_with(".zip") {
        Some(ArchiveKind::Zip)
    } else if path.ends_with(".tar") {
        Some(ArchiveKind::Tar)
    } else {
        None
    }
}

fn unzip_reader<R: std::io::Read + std::io::Seek>(path: &Path, file: R) -> Result<(), Error> {
    let mut archive = zip::ZipArchive::new(file)?;
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
#[specta::specta]
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
#[specta::specta]
pub async fn file_exists(path: String) -> Result<bool, Error> {
    Ok(Path::new(&path).exists())
}

#[derive(Debug, Type, serde::Serialize)]
pub struct FileMetadata {
    pub last_modified: u32,
}

#[tauri::command]
#[specta::specta]
pub async fn get_file_metadata(path: String) -> Result<FileMetadata, Error> {
    let metadata = std::fs::metadata(path)?;
    let last_modified = metadata
        .modified()?
        .duration_since(std::time::SystemTime::UNIX_EPOCH)?;
    Ok(FileMetadata {
        last_modified: last_modified.as_secs() as u32,
    })
}
