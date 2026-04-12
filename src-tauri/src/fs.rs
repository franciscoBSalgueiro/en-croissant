use std::{
    ffi::OsStr,
    fs::create_dir_all,
    io::Cursor,
    path::{Path, PathBuf},
};

use log::info;
use reqwest::{header::HeaderMap, Client};
use specta::Type;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use futures_util::StreamExt;

use crate::error::Error;
use crate::progress::update_progress;
use crate::AppState;

fn canonicalize_or_original(path: PathBuf) -> PathBuf {
    path.canonicalize().unwrap_or(path)
}

#[cfg(unix)]
fn is_executable(path: &Path) -> bool {
    let Ok(metadata) = std::fs::metadata(path) else {
        return false;
    };
    metadata.is_file() && metadata.permissions().mode() & 0o111 != 0
}

#[cfg(not(unix))]
fn is_executable(path: &Path) -> bool {
    path.is_file()
}

#[cfg(target_os = "windows")]
fn executable_extensions(name: &Path) -> Vec<String> {
    if name.extension().is_some() {
        return vec![String::new()];
    }

    let mut extensions = vec![String::new()];
    let path_ext = std::env::var("PATHEXT").unwrap_or_else(|_| ".COM;.EXE;.BAT;.CMD".to_string());
    extensions.extend(
        path_ext
            .split(';')
            .filter(|ext| !ext.is_empty())
            .map(|ext| ext.to_ascii_lowercase()),
    );
    extensions
}

#[cfg(not(target_os = "windows"))]
fn executable_extensions(_name: &Path) -> Vec<String> {
    vec![String::new()]
}

fn find_executable_in_path(name: &str, search_path: &OsStr) -> Option<PathBuf> {
    let name_path = Path::new(name);
    if name_path.is_absolute() || name.contains('/') || name.contains('\\') {
        return is_executable(name_path).then(|| canonicalize_or_original(name_path.to_path_buf()));
    }

    for dir in std::env::split_paths(search_path) {
        for extension in executable_extensions(name_path) {
            let candidate = if extension.is_empty() {
                dir.join(name)
            } else {
                dir.join(format!("{name}{extension}"))
            };
            if is_executable(&candidate) {
                return Some(canonicalize_or_original(candidate));
            }
        }
    }

    None
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
    let total_size = if let Some(total_size) = total_size {
        Some(total_size as u64)
    } else {
        res.content_length()
    };

    let mut file: Vec<u8> = Vec::new();
    let mut downloaded: u64 = 0;
    let mut stream = res.bytes_stream();

    while let Some(item) = stream.next().await {
        let chunk = item?;
        file.extend_from_slice(&chunk);
        downloaded += chunk.len() as u64;
        if let Some(total_size) = total_size {
            let progress = ((downloaded as f32 / total_size as f32) * 100.0).min(100.0);
            update_progress(&state.progress_state, &app, id.clone(), progress, false)?;
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
        update_progress(&state.progress_state, &app, id, 100.0, true)?;
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
pub async fn find_executable_on_path(name: String) -> Option<String> {
    let search_path = std::env::var_os("PATH")?;
    find_executable_in_path(&name, &search_path).map(|path| path.to_string_lossy().into_owned())
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
mod tests {
    use super::find_executable_in_path;

    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;

    #[test]
    fn finds_executable_in_search_path() {
        let dir = tempfile::tempdir().unwrap();
        #[cfg(target_os = "windows")]
        let engine_path = dir.path().join("stockfish.exe");
        #[cfg(not(target_os = "windows"))]
        let engine_path = dir.path().join("stockfish");

        std::fs::write(&engine_path, "").unwrap();
        #[cfg(unix)]
        {
            let mut permissions = std::fs::metadata(&engine_path).unwrap().permissions();
            permissions.set_mode(0o755);
            std::fs::set_permissions(&engine_path, permissions).unwrap();
        }

        let search_path = std::env::join_paths([dir.path()]).unwrap();
        let resolved = find_executable_in_path("stockfish", &search_path).unwrap();

        assert_eq!(resolved, engine_path.canonicalize().unwrap());
    }
}
