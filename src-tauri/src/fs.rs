use std::{
    fs::create_dir_all,
    path::{Path, PathBuf},
    time::{Duration, Instant},
};

use log::{error, info, warn};
use reqwest::Client;
use specta::Type;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use flate2::read::GzDecoder;

use crate::error::Error;
use crate::progress::{update_download_progress, update_progress};
use crate::AppState;

#[path = "download.rs"]
mod download;

#[tauri::command]
#[specta::specta]
pub fn cancel_download(id: String, state: tauri::State<'_, AppState>) {
    if let Some(handle) = state.downloads.get(&id) {
        info!("Download [{id}]: cancellation requested");
        handle.abort();
    }
}

#[allow(clippy::too_many_arguments)] // Public command arguments are part of the frontend API.
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
    let started = Instant::now();
    let result = download_file_inner(
        &id,
        &url,
        &path,
        &app,
        &state,
        DownloadOptions {
            token,
            finalize,
            total_size,
        },
    )
    .await;
    if let Err(ref failure) = result {
        if failure.to_string() != "Download cancelled" {
            let message = match failure {
                Error::Reqwest(error) => {
                    let mut message = error.to_string();
                    let mut source = std::error::Error::source(error.as_ref());
                    while let Some(cause) = source {
                        message.push_str(&format!("; caused by: {cause}"));
                        source = cause.source();
                    }
                    if let Some(url) = error.url() {
                        message = message.replace(url.as_str(), &download_log_url(url.as_str()));
                    }
                    format!(
                        "{message}; timeout={}, connect={}, status={:?}",
                        error.is_timeout(),
                        error.is_connect(),
                        error.status()
                    )
                }
                _ => failure.to_string(),
            };
            error!(
                "Download [{id}]: failed after {:.1}s: {message}",
                started.elapsed().as_secs_f64()
            );
        }
    }
    result
}

struct DownloadOptions {
    token: Option<String>,
    finalize: Option<bool>,
    total_size: Option<u32>,
}

async fn download_file_inner(
    id: &str,
    url: &str,
    path: &Path,
    app: &tauri::AppHandle,
    state: &AppState,
    options: DownloadOptions,
) -> Result<(), Error> {
    let DownloadOptions {
        token,
        finalize,
        total_size,
    } = options;
    let started = Instant::now();
    let (handle, registration) = futures_util::future::AbortHandle::new_pair();
    match state.downloads.entry(id.to_owned()) {
        dashmap::mapref::entry::Entry::Occupied(_) => {
            return Err(std::io::Error::other("Download already running").into());
        }
        dashmap::mapref::entry::Entry::Vacant(entry) => {
            entry.insert(handle);
        }
    }
    let result = futures_util::future::Abortable::new(
        async {
            update_progress(&state.progress_state, app, id.to_owned(), 0.0, false)?;
            info!(
                "Download [{id}]: starting {} (connect timeout=30s, read inactivity timeout=60s)",
                download_log_url(url)
            );
            download::receive(
                id,
                url,
                path,
                token.as_deref(),
                total_size.map(u64::from),
                |downloaded, total, speed| {
                    update_download_progress(
                        &state.progress_state,
                        app,
                        id.to_owned(),
                        download_percentage(downloaded, total),
                        false,
                        Some(speed),
                    )
                },
            )
            .await
        },
        registration,
    )
    .await;
    state.downloads.remove(id);
    let file = match result {
        Ok(Ok(file)) => file,
        Ok(Err(error)) => {
            state.progress_state.remove(id);
            return Err(error);
        }
        Err(_) => {
            info!(
                "Download [{id}]: cancelled after {:.1}s; partial download retained on disk",
                started.elapsed().as_secs_f64()
            );
            state.progress_state.remove(id);
            return Err(std::io::Error::other("Download cancelled").into());
        }
    };
    update_progress(&state.progress_state, app, id.to_owned(), 100.0, false)?;
    let finalize = finalize.unwrap_or(true);
    let path = Path::new(&path);

    info!(
        "Download [{id}]: saving/extracting {:?} to {}",
        archive_kind(url),
        path.display()
    );

    if let Some(kind) = archive_kind(url) {
        match kind {
            ArchiveKind::Zip => unzip_file(path, std::fs::File::open(&file.path)?).await?,
            ArchiveKind::Tar => {
                let mut archive = tar::Archive::new(std::fs::File::open(&file.path)?);
                archive.unpack(path)?;
            }
            ArchiveKind::TarGz => unpack_tar_gz(path, std::fs::File::open(&file.path)?)?,
        }
        file.remove();
    } else {
        file.install(path)?;
    }
    if finalize {
        update_progress(&state.progress_state, app, id.to_owned(), 100.0, true)?;
    }
    info!(
        "Download [{id}]: saved successfully to {} ({:.1}s total)",
        path.display(),
        started.elapsed().as_secs_f64()
    );
    Ok(())
}

struct DownloadRate {
    sampled_at: Instant,
    sampled_bytes: u64,
}

impl DownloadRate {
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

fn download_log_url(raw: &str) -> String {
    let Ok(mut url) = reqwest::Url::parse(raw) else {
        warn!("Download URL could not be parsed");
        return "<invalid URL>".to_string();
    };
    let _ = url.set_username("");
    let _ = url.set_password(None);
    url.set_query(None);
    url.set_fragment(None);
    url.to_string()
}

fn download_client() -> Result<Client, reqwest::Error> {
    Client::builder()
        .no_gzip()
        .no_brotli()
        .no_deflate()
        .no_zstd()
        .connect_timeout(Duration::from_secs(30))
        .read_timeout(Duration::from_secs(60))
        .build()
}

fn unpack_tar_gz(path: &Path, file: std::fs::File) -> Result<(), Error> {
    let decoder = GzDecoder::new(file);
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

pub async fn unzip_file(path: &Path, file: std::fs::File) -> Result<(), Error> {
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

#[cfg(test)]
mod download_tests {
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

    #[test]
    fn download_logs_omit_credentials_and_signed_query_parameters() {
        assert_eq!(
            super::download_log_url(
                "https://user:secret@example.com/database.zip?token=private#fragment"
            ),
            "https://example.com/database.zip"
        );
        assert_eq!(
            super::download_log_url("not a URL containing secrets"),
            "<invalid URL>"
        );
    }
}
