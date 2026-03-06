use crate::error::Error;

pub struct SoundServerPort(pub u16);

#[cfg(target_os = "linux")]
mod server {
    use axum::{
        extract::Path as AxumPath,
        http::{header, HeaderMap, StatusCode},
        response::IntoResponse,
        routing::get,
        Extension, Router,
    };
    use std::net::TcpListener;
    use std::path::PathBuf;

    fn parse_range(range_header: &str, total_len: usize) -> Option<(usize, usize)> {
        let range_str = range_header.strip_prefix("bytes=")?;
        let mut parts = range_str.splitn(2, '-');
        let start_str = parts.next()?.trim();
        let end_str = parts.next()?.trim();

        let start = if start_str.is_empty() {
            let suffix: usize = end_str.parse().ok()?;
            total_len.saturating_sub(suffix)
        } else {
            start_str.parse().ok()?
        };

        let end = if end_str.is_empty() {
            total_len - 1
        } else {
            end_str.parse::<usize>().ok()?.min(total_len - 1)
        };

        if start <= end && start < total_len {
            Some((start, end))
        } else {
            None
        }
    }

    fn content_type_for(path: &std::path::Path) -> &'static str {
        match path.extension().and_then(|e| e.to_str()) {
            Some("mp3") => "audio/mpeg",
            Some("ogg") => "audio/ogg",
            Some("wav") => "audio/wav",
            Some("flac") => "audio/flac",
            _ => "application/octet-stream",
        }
    }

    async fn serve_sound(
        AxumPath(path): AxumPath<String>,
        headers: HeaderMap,
        Extension(sound_dir): Extension<PathBuf>,
    ) -> impl IntoResponse {
        let file_path = sound_dir.join(&path);

        let canonical = match file_path.canonicalize() {
            Ok(p) => p,
            Err(_) => return StatusCode::NOT_FOUND.into_response(),
        };
        let dir_canonical = match sound_dir.canonicalize() {
            Ok(p) => p,
            Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
        };
        if !canonical.starts_with(&dir_canonical) {
            return StatusCode::FORBIDDEN.into_response();
        }

        let data = match tokio::fs::read(&canonical).await {
            Ok(d) => d,
            Err(_) => return StatusCode::NOT_FOUND.into_response(),
        };

        let total_len = data.len();
        let content_type = content_type_for(&canonical);

        if let Some(range_val) = headers.get(header::RANGE) {
            if let Ok(range_str) = range_val.to_str() {
                if let Some((start, end)) = parse_range(range_str, total_len) {
                    let chunk = data[start..=end].to_vec();
                    return (
                        StatusCode::PARTIAL_CONTENT,
                        [
                            (header::CONTENT_TYPE, content_type.to_string()),
                            (header::ACCEPT_RANGES, "bytes".to_string()),
                            (header::CONTENT_LENGTH, chunk.len().to_string()),
                            (
                                header::CONTENT_RANGE,
                                format!("bytes {start}-{end}/{total_len}"),
                            ),
                        ],
                        chunk,
                    )
                        .into_response();
                }
            }
        }

        (
            StatusCode::OK,
            [
                (header::CONTENT_TYPE, content_type.to_string()),
                (header::ACCEPT_RANGES, "bytes".to_string()),
                (header::CONTENT_LENGTH, total_len.to_string()),
            ],
            data,
        )
            .into_response()
    }

    pub fn start_sound_server(sound_dir: PathBuf) -> u16 {
        let listener = TcpListener::bind("127.0.0.1:0").expect("failed to bind sound server");
        let port = listener.local_addr().unwrap().port();

        let app = Router::new()
            .route("/*path", get(serve_sound))
            .layer(Extension(sound_dir));

        tauri::async_runtime::spawn(async move {
            axum::Server::from_tcp(listener)
                .expect("failed to create sound server")
                .serve(app.into_make_service())
                .await
                .expect("sound server error");
        });

        log::info!("Sound server started on port {port}");
        port
    }
}

#[cfg(target_os = "linux")]
pub use server::start_sound_server;

#[tauri::command]
#[specta::specta]
pub fn get_sound_server_port(
    state: tauri::State<'_, SoundServerPort>,
) -> Result<u16, Error> {
    Ok(state.0)
}
