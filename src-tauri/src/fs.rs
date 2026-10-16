use std::{
    fs::create_dir_all,
    io::Cursor,
    path::{Path, PathBuf},
    time::{Duration, Instant},
};

use log::info;
use reqwest::{header::HeaderMap, Client};
use specta::Type;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use flate2::read::GzDecoder;
use futures_util::StreamExt;

use crate::error::Error;
use crate::progress::{update_download_progress, update_progress};
use crate::AppState;

#[tauri::command]
#[specta::specta]
pub fn cancel_download(id: String, state: tauri::State<'_, AppState>) {
    if let Some(handle) = state.downloads.get(&id) {
        handle.abort();
    }
}

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
    let (handle, registration) = futures_util::future::AbortHandle::new_pair();
    match state.downloads.entry(id.clone()) {
        dashmap::mapref::entry::Entry::Occupied(_) => {
            return Err(std::io::Error::other("Download already running").into());
        }
        dashmap::mapref::entry::Entry::Vacant(entry) => {
            entry.insert(handle);
        }
    }
    let transfer = async {
        update_progress(&state.progress_state, &app, id.clone(), 0.0, false)?;
        info!("Downloading file from {}", url);
        let client = Client::new();
        let mut req = client.get(&url);
        if let Some(token) = token {
            let mut header_map = HeaderMap::new();
            header_map.insert("Authorization", format!("Bearer {token}").parse().unwrap());
            req = req.headers(header_map);
        }
        receive_download(req, total_size, |progress, speed| {
            update_download_progress(
                &state.progress_state,
                &app,
                id.clone(),
                progress,
                false,
                speed,
            )
        })
        .await
    };
    let result = futures_util::future::Abortable::new(transfer, registration).await;
    state.downloads.remove(&id);
    let file = match result {
        Ok(Ok(file)) => file,
        Ok(Err(error)) => {
            state.progress_state.remove(&id);
            return Err(error);
        }
        Err(_) => {
            state.progress_state.remove(&id);
            return Err(std::io::Error::other("Download cancelled").into());
        }
    };
    update_progress(&state.progress_state, &app, id.clone(), 100.0, false)?;
    let path = Path::new(&path);

    info!("Downloaded file to {}", path.display());

    match archive_kind(&url) {
        Some(ArchiveKind::Zip) => unzip_file(path, file).await?,
        Some(ArchiveKind::Tar) => {
            let mut archive = tar::Archive::new(Cursor::new(file));
            archive.unpack(path)?;
        }
        Some(ArchiveKind::TarGz) => {
            unpack_tar_gz(path, file)?;
        }
        None => std::fs::write(path, file)?,
    }

    if finalize {
        update_progress(&state.progress_state, &app, id, 100.0, true)?;
    }
    Ok(())
}

fn unpack_tar_gz(path: &Path, file: Vec<u8>) -> Result<(), Error> {
    let decoder = GzDecoder::new(Cursor::new(file));
    let mut archive = tar::Archive::new(decoder);
    archive.unpack(path)?;
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

// Throttle progress notifications, never reads from the network.
async fn receive_download(
    request: reqwest::RequestBuilder,
    total_size: Option<u32>,
    mut on_progress: impl FnMut(f32, Option<f64>) -> Result<(), Error>,
) -> Result<Vec<u8>, Error> {
    let response = request.send().await?.error_for_status()?;
    let total_size = total_size
        .map(u64::from)
        .or_else(|| response.content_length());
    let mut stream = response.bytes_stream();
    let mut file = Vec::new();
    let mut downloaded = 0;
    let mut rate = DownloadRate::new();
    let mut heartbeat = tokio::time::interval(Duration::from_secs(1));
    heartbeat.tick().await;
    loop {
        tokio::select! {
            item = stream.next() => {
                let Some(item) = item else { break; };
                let chunk = item?;
                downloaded += chunk.len() as u64;
                file.extend_from_slice(&chunk);
            }
            _ = heartbeat.tick() => {}
        }
        if let Some(speed) = rate.sample(downloaded, Instant::now()) {
            on_progress(download_percentage(downloaded, total_size), Some(speed))?;
        }
    }
    Ok(file)
}

struct DownloadRate {
    sampled_at: Instant,
    sampled_bytes: u64,
}

impl DownloadRate {
    fn new() -> Self {
        Self {
            sampled_at: Instant::now(),
            sampled_bytes: 0,
        }
    }

    fn sample(&mut self, bytes: u64, now: Instant) -> Option<f64> {
        let elapsed = now.duration_since(self.sampled_at);
        if elapsed < Duration::from_millis(250) {
            return None;
        }
        let speed = (bytes - self.sampled_bytes) as f64 / elapsed.as_secs_f64();
        self.sampled_at = now;
        self.sampled_bytes = bytes;
        Some(speed)
    }
}

fn download_percentage(downloaded: u64, total: Option<u64>) -> f32 {
    total
        .filter(|total| *total > 0)
        .map(|total| ((downloaded as f64 / total as f64) * 100.0).min(99.9) as f32)
        .unwrap_or(0.0)
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

#[cfg(test)]
mod download_tests {
    async fn assert_cancel_stalled_transfer(send_headers: bool) {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let (ready, received) = tokio::sync::oneshot::channel();
        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut request = [0; 4096];
            socket.read(&mut request).await.unwrap();
            if send_headers {
                socket
                    .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 100\r\n\r\ndata")
                    .await
                    .unwrap();
            }
            ready.send(()).unwrap();
            std::future::pending::<()>().await;
        });
        let (handle, registration) = futures_util::future::AbortHandle::new_pair();
        let (sampled, sample) = tokio::sync::oneshot::channel();
        let mut sampled = Some(sampled);
        let transfer = tokio::spawn(futures_util::future::Abortable::new(
            super::receive_download(
                reqwest::Client::new().get(format!("http://{address}")),
                None,
                move |_, _| {
                    if let Some(sampled) = sampled.take() {
                        let _ = sampled.send(());
                    }
                    Ok(())
                },
            ),
            registration,
        ));
        tokio::time::timeout(std::time::Duration::from_secs(5), received)
            .await
            .unwrap()
            .unwrap();
        if send_headers {
            // A progress sample proves the response body is being consumed.
            tokio::time::timeout(std::time::Duration::from_secs(5), sample)
                .await
                .unwrap()
                .unwrap();
        }
        handle.abort();
        let result = tokio::time::timeout(std::time::Duration::from_secs(1), transfer).await;
        server.abort();
        assert!(matches!(result, Ok(Ok(Err(_)))));
    }

    #[tokio::test]
    async fn cancellation_interrupts_waiting_for_response_headers() {
        assert_cancel_stalled_transfer(false).await;
    }

    #[tokio::test]
    async fn cancellation_interrupts_a_stalled_response_body() {
        assert_cancel_stalled_transfer(true).await;
    }

    #[test]
    fn speed_samples_are_throttled_and_drop_to_zero_when_stalled() {
        let start = std::time::Instant::now();
        let mut rate = super::DownloadRate {
            sampled_at: start,
            sampled_bytes: 0,
        };
        assert_eq!(
            rate.sample(100, start + std::time::Duration::from_millis(100)),
            None
        );
        assert_eq!(
            rate.sample(1024, start + std::time::Duration::from_millis(250)),
            Some(4096.0)
        );
        assert_eq!(
            rate.sample(2048, start + std::time::Duration::from_millis(500)),
            Some(4096.0)
        );
        assert_eq!(
            rate.sample(2048, start + std::time::Duration::from_millis(1500)),
            Some(0.0)
        );
    }

    #[test]
    fn percentage_supports_unknown_sizes_and_reserves_100_for_finalizing() {
        assert_eq!(super::download_percentage(1024, None), 0.0);
        assert_eq!(super::download_percentage(1024, Some(0)), 0.0);
        assert_eq!(super::download_percentage(512, Some(1024)), 50.0);
        assert_eq!(super::download_percentage(1024, Some(1024)), 99.9);
    }
}
