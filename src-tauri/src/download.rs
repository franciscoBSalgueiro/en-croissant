//! Disk-backed HTTP downloads. Sidecar metadata binds partial bytes to a URL and
//! a strong validator; an unvalidated or changed representation is never appended.
use std::{
    collections::hash_map::DefaultHasher,
    fs::{File, OpenOptions},
    hash::{Hash, Hasher},
    io::{ErrorKind, Write},
    path::{Path, PathBuf},
    sync::Arc,
    time::{Duration, Instant},
};

use dashmap::DashMap;
use futures_util::StreamExt;
use log::{info, warn};
use once_cell::sync::Lazy;
use reqwest::{header, Client, Response, StatusCode};
use serde::{Deserialize, Serialize};
use tokio::sync::{Mutex, OwnedMutexGuard};

use super::{download_client, download_log_url, DownloadRate};
use crate::error::Error;

static LOCKS: Lazy<DashMap<PathBuf, Arc<Mutex<()>>>> = Lazy::new(DashMap::new);
const MAX_RETRIES: u32 = 3;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
enum Validator {
    Etag(String),
    LastModified(String),
}

impl Validator {
    fn from_response(response: &Response) -> Option<Self> {
        let headers = response.headers();
        if let Some(etag) = headers.get(header::ETAG) {
            let value = etag.to_str().ok()?;
            return Self::Etag(value.to_owned())
                .usable()
                .then(|| Self::Etag(value.to_owned()));
        }
        // RFC 9110: dates may be used for If-Range only when strong. A Date
        // at least 60 seconds newer than Last-Modified establishes that here.
        let modified = headers.get(header::LAST_MODIFIED)?.to_str().ok()?;
        let date = headers.get(header::DATE)?.to_str().ok()?;
        let modified_date = chrono::DateTime::parse_from_rfc2822(modified).ok()?;
        let response_date = chrono::DateTime::parse_from_rfc2822(date).ok()?;
        (response_date
            .signed_duration_since(modified_date)
            .num_seconds()
            >= 60)
            .then(|| Self::LastModified(modified.to_owned()))
    }

    fn usable(&self) -> bool {
        match self {
            Self::Etag(value) => value.len() >= 2 && value.starts_with('"') && value.ends_with('"'),
            Self::LastModified(value) => chrono::DateTime::parse_from_rfc2822(value).is_ok(),
        }
    }

    fn value(&self) -> &str {
        match self {
            Self::Etag(value) | Self::LastModified(value) => value,
        }
    }

    fn matches(&self, response: &Response) -> bool {
        let name = match self {
            Self::Etag(_) => header::ETAG,
            Self::LastModified(_) => header::LAST_MODIFIED,
        };
        response
            .headers()
            .get(name)
            .and_then(|value| value.to_str().ok())
            == Some(self.value())
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct Metadata {
    url: String,
    resolved_url: String,
    destination: PathBuf,
    validator: Option<Validator>,
    total: Option<u64>,
}

pub(super) struct DownloadedFile {
    pub path: PathBuf,
    metadata: PathBuf,
    // Keep concurrent requests for this destination from editing the same part,
    // including the interval between transfer completion and installation.
    _guard: OwnedMutexGuard<()>,
}

impl DownloadedFile {
    pub fn install(self, destination: &Path) -> Result<(), Error> {
        std::fs::rename(&self.path, destination)?;
        remove_sidecar(&self.metadata);
        Ok(())
    }

    pub fn remove(self) {
        remove_sidecar(&self.path);
        remove_sidecar(&self.metadata);
    }
}

fn remove_sidecar(path: &Path) {
    if let Err(error) = std::fs::remove_file(path) {
        if error.kind() != ErrorKind::NotFound {
            warn!(
                "Could not remove download sidecar {}: {error}",
                path.display()
            );
        }
    }
}

fn part_paths(url: &str, destination: &Path) -> (PathBuf, PathBuf) {
    let directory = if super::archive_kind(url).is_some() {
        destination
    } else {
        destination.parent().unwrap_or_else(|| Path::new("."))
    }
    .join(".en-croissant-downloads");
    // No credentials or URL parameters appear in filenames or logs. The sidecar
    // also checks the full URL/destination before a partial file can be reused.
    let mut key = DefaultHasher::new();
    url.hash(&mut key);
    destination.hash(&mut key);
    let key = format!("{:016x}", key.finish());
    (
        directory.join(format!("{key}.part")),
        directory.join(format!("{key}.json")),
    )
}

fn save_metadata(path: &Path, metadata: &Metadata) -> Result<(), Error> {
    let mut file = tempfile::NamedTempFile::new_in(path.parent().unwrap())?;
    serde_json::to_writer(&mut file, metadata).map_err(std::io::Error::other)?;
    file.as_file().sync_all()?;
    file.persist(path).map_err(|error| error.error)?;
    Ok(())
}

fn invalid(message: &str) -> Error {
    std::io::Error::new(ErrorKind::InvalidData, message).into()
}

fn retryable(error: &Error) -> bool {
    match error {
        Error::Reqwest(error) => {
            error.is_timeout()
                || error.is_connect()
                || error.is_body()
                || error.is_request()
                || error.is_decode()
                || error.status().is_some_and(|status| {
                    status.is_server_error() || status == StatusCode::TOO_MANY_REQUESTS
                })
        }
        Error::Io(error) => error.kind() == ErrorKind::UnexpectedEof,
        _ => false,
    }
}

pub(super) async fn receive(
    id: &str,
    url: &str,
    destination: &Path,
    token: Option<&str>,
    size_hint: Option<u64>,
    mut report: impl FnMut(u64, Option<u64>, f64) -> Result<(), Error>,
) -> Result<DownloadedFile, Error> {
    let (part, metadata) = part_paths(url, destination);
    let lock = LOCKS.entry(part.clone()).or_default().clone();
    let guard = lock.lock_owned().await;
    std::fs::create_dir_all(part.parent().unwrap())?;
    let client = download_client()?;
    for attempt in 0..=MAX_RETRIES {
        match receive_attempt(
            id,
            &client,
            url,
            destination,
            token,
            size_hint,
            &part,
            &metadata,
            &mut report,
        )
        .await
        {
            Ok(()) => {
                return Ok(DownloadedFile {
                    path: part,
                    metadata,
                    _guard: guard,
                })
            }
            Err(error) if attempt < MAX_RETRIES && retryable(&error) => {
                let bytes = std::fs::metadata(&part).map(|file| file.len()).unwrap_or(0);
                let delay = 1 << attempt;
                warn!("Download [{id}]: transfer interrupted; {bytes} bytes saved, retry {}/{} in {delay}s", attempt + 1, MAX_RETRIES);
                tokio::time::sleep(Duration::from_secs(delay)).await;
            }
            Err(error) => return Err(error),
        }
    }
    unreachable!()
}

// Content-Range is checked before opening a partial file for append.
fn content_range(response: &Response) -> Option<(u64, u64, u64)> {
    let value = response
        .headers()
        .get(header::CONTENT_RANGE)?
        .to_str()
        .ok()?;
    let (range, total) = value.strip_prefix("bytes ")?.split_once('/')?;
    let (start, end) = range.split_once('-')?;
    let (start, end, total) = (start.parse().ok()?, end.parse().ok()?, total.parse().ok()?);
    (start <= end && end < total).then_some((start, end, total))
}

#[allow(clippy::too_many_arguments)]
async fn receive_attempt(
    id: &str,
    client: &Client,
    url: &str,
    destination: &Path,
    token: Option<&str>,
    size_hint: Option<u64>,
    part: &Path,
    metadata_path: &Path,
    report: &mut impl FnMut(u64, Option<u64>, f64) -> Result<(), Error>,
) -> Result<(), Error> {
    let saved: Option<Metadata> = std::fs::read(metadata_path)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok());
    let length = std::fs::metadata(part).map(|file| file.len()).unwrap_or(0);
    let saved = saved.filter(|saved| {
        saved.url == url
            && saved.destination == destination
            && saved.validator.as_ref().is_some_and(Validator::usable)
            && saved.total.is_none_or(|total| length <= total)
    });
    let mut offset = if saved.is_some() { length } else { 0 };
    let mut heartbeat = tokio::time::interval(Duration::from_secs(1));
    heartbeat.tick().await;
    let started = Instant::now();
    let mut last_log = Instant::now();
    let mut restarted = false;
    let (response, total, validator) = loop {
        let previous = saved.as_ref().filter(|_| offset > 0 && !restarted);
        report(
            offset,
            previous.and_then(|saved| saved.total).or(size_hint),
            0.0,
        )?;
        let mut request = client.get(url).header(header::ACCEPT_ENCODING, "identity");
        if let Some(token) = token {
            request = request.bearer_auth(token);
        }
        if let Some(saved) = previous {
            info!("Download [{id}]: resuming from byte {offset}");
            request = request
                .header(header::RANGE, format!("bytes={offset}-"))
                .header(header::IF_RANGE, saved.validator.as_ref().unwrap().value());
        }
        let request = request.send();
        tokio::pin!(request);
        let response = loop {
            tokio::select! {
                response = &mut request => break response?,
                _ = heartbeat.tick() => {
                    if last_log.elapsed() >= Duration::from_secs(10) {
                        info!("Download [{id}]: waiting for HTTP response ({:.1}s elapsed)", started.elapsed().as_secs_f64());
                        last_log = Instant::now();
                    }
                }
            }
        };
        info!(
            "Download [{id}]: HTTP {} from {}, content length={}, content type={}, response after {:.1}s",
            response.status(),
            download_log_url(response.url().as_str()),
            response.content_length().map(|size| size.to_string()).unwrap_or_else(|| "unknown".to_owned()),
            response.headers().get(header::CONTENT_TYPE).and_then(|value| value.to_str().ok()).unwrap_or("unknown"),
            started.elapsed().as_secs_f64()
        );
        if let Some(saved) = previous {
            if response.status() == StatusCode::RANGE_NOT_SATISFIABLE {
                let total = response
                    .headers()
                    .get(header::CONTENT_RANGE)
                    .and_then(|value| value.to_str().ok())
                    .and_then(|value| value.strip_prefix("bytes */"))
                    .and_then(|value| value.parse::<u64>().ok());
                if total == Some(offset)
                    && saved.total.is_none_or(|expected| total == Some(expected))
                    && saved.resolved_url == response.url().as_str()
                    && saved.validator.as_ref().unwrap().matches(&response)
                {
                    File::open(part)?.sync_all()?;
                    report(offset, total, 0.0)?;
                    return Ok(());
                }
                warn!("Download [{id}]: saved range is no longer valid; restarting safely");
                offset = 0;
                restarted = true;
                continue;
            }
        }
        let response = response.error_for_status()?;
        if response
            .headers()
            .get(header::CONTENT_ENCODING)
            .is_some_and(|encoding| encoding != "identity")
        {
            return Err(invalid("Cannot safely resume an encoded download"));
        }
        if response.status() == StatusCode::PARTIAL_CONTENT {
            let range = content_range(&response);
            let valid = previous.is_some_and(|saved| {
                saved.resolved_url == response.url().as_str()
                    && saved.validator.as_ref().unwrap().matches(&response)
                    && range.is_some_and(|(start, end, total)| {
                        start == offset
                            && saved.total.is_none_or(|old| old == total)
                            && response
                                .content_length()
                                .is_none_or(|length| length == end - start + 1)
                    })
            });
            if !valid {
                if previous.is_none() {
                    return Err(invalid("Invalid partial download response"));
                }
                warn!("Download [{id}]: range or validator changed; restarting safely");
                offset = 0;
                restarted = true;
                continue;
            }
            let total = range.unwrap().2;
            let validator = saved.as_ref().unwrap().validator.clone();
            break (response, Some(total), validator);
        }
        if response.status() != StatusCode::OK {
            return Err(invalid("Unexpected download response status"));
        }
        if offset > 0 {
            info!("Download [{id}]: server sent a full response; replacing the partial download");
        }
        offset = 0;
        let total = response.content_length();
        let validator = Validator::from_response(&response);
        break (response, total, validator);
    };

    // Invalidate the old sidecar before truncating/replacing its bytes. If the
    // process stops between these operations the next attempt starts fresh.
    if offset == 0 {
        match std::fs::remove_file(metadata_path) {
            Ok(()) => (),
            Err(error) if error.kind() == ErrorKind::NotFound => (),
            Err(error) => return Err(error.into()),
        }
    }
    let mut output = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(offset == 0)
        .append(offset > 0)
        .open(part)?;
    save_metadata(
        metadata_path,
        &Metadata {
            url: url.to_owned(),
            resolved_url: response.url().to_string(),
            destination: destination.to_owned(),
            validator,
            total,
        },
    )?;
    let mut downloaded = offset;
    let mut rate = DownloadRate {
        sampled_at: Instant::now(),
        sampled_bytes: offset,
    };
    let mut last_data = Instant::now();
    let mut first_chunk = true;
    let total_label = total
        .or(size_hint)
        .map(|size| size.to_string())
        .unwrap_or_else(|| "unknown".to_owned());
    report(downloaded, total.or(size_hint), 0.0)?;
    let mut stream = response.bytes_stream();
    loop {
        let item = tokio::select! {
            item = stream.next() => item,
            _ = heartbeat.tick() => {
                if let Some(speed) = rate.sample(downloaded, Instant::now()) { report(downloaded, total.or(size_hint), speed)?; }
                if last_log.elapsed() >= Duration::from_secs(10) {
                    info!("Download [{id}]: received {downloaded} / {total_label} bytes; {:.1}s since last data", last_data.elapsed().as_secs_f64());
                    last_log = Instant::now();
                }
                continue;
            }
        };
        let Some(item) = item else {
            break;
        };
        let chunk = item?;
        if total.is_some_and(|total| chunk.len() as u64 > total.saturating_sub(downloaded)) {
            return Err(invalid("Download exceeded its advertised size"));
        }
        // A synchronous, unbuffered write finishes before cancellation can be
        // observed. A retry always uses the actual file length, with no pending
        // background writes that could race the next append.
        output.write_all(&chunk)?;
        downloaded += chunk.len() as u64;
        last_data = Instant::now();
        if first_chunk {
            info!("Download [{id}]: first data received after {:.1}s; continuing at byte {downloaded}", started.elapsed().as_secs_f64());
            first_chunk = false;
        }
        if let Some(speed) = rate.sample(downloaded, Instant::now()) {
            report(downloaded, total.or(size_hint), speed)?;
        }
    }
    if total.is_some_and(|total| downloaded != total) {
        return Err(std::io::Error::new(
            ErrorKind::UnexpectedEof,
            "Download ended before its advertised size",
        )
        .into());
    }
    output.sync_all()?;
    info!("Download [{id}]: complete; {downloaded} bytes saved to disk");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    type Requests = Arc<std::sync::Mutex<Vec<String>>>;

    async fn server(responses: Vec<String>) -> (String, Requests, tokio::task::JoinHandle<()>) {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}/database.db3", listener.local_addr().unwrap());
        let requests = Arc::new(std::sync::Mutex::new(Vec::new()));
        let captured = requests.clone();
        let task = tokio::spawn(async move {
            for response in responses {
                let (mut socket, _) = listener.accept().await.unwrap();
                let mut request = Vec::new();
                while !request.ends_with(b"\r\n\r\n") {
                    let mut bytes = [0; 1024];
                    let size = socket.read(&mut bytes).await.unwrap();
                    assert!(size > 0);
                    request.extend_from_slice(&bytes[..size]);
                }
                captured
                    .lock()
                    .unwrap()
                    .push(String::from_utf8(request).unwrap().to_lowercase());
                socket.write_all(response.as_bytes()).await.unwrap();
            }
        });
        (url, requests, task)
    }

    fn response(status: &str, headers: &str, body: &str) -> String {
        format!("HTTP/1.1 {status}\r\nConnection: close\r\n{headers}\r\n{body}")
    }

    fn seed(
        url: &str,
        destination: &Path,
        bytes: &[u8],
        validator: Option<Validator>,
        total: Option<u64>,
    ) {
        let (part, sidecar) = part_paths(url, destination);
        std::fs::create_dir_all(part.parent().unwrap()).unwrap();
        std::fs::write(part, bytes).unwrap();
        save_metadata(
            &sidecar,
            &Metadata {
                url: url.to_owned(),
                resolved_url: url.to_owned(),
                destination: destination.to_owned(),
                validator,
                total,
            },
        )
        .unwrap();
    }

    fn etag() -> Option<Validator> {
        Some(Validator::Etag("\"v1\"".to_owned()))
    }

    #[tokio::test]
    async fn resumes_a_truncated_response_and_installs_only_when_complete() {
        let (url, requests, task) = server(vec![
            response("200 OK", "Content-Length: 8\r\nETag: \"v1\"\r\n", "ABCD"),
            response(
                "206 Partial Content",
                "Content-Length: 4\r\nETag: \"v1\"\r\nContent-Range: bytes 4-7/8\r\n",
                "EFGH",
            ),
        ])
        .await;
        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("db.db3");
        std::fs::write(&destination, b"previous database").unwrap();
        let mut progress = Vec::new();
        let downloaded = receive("test", &url, &destination, None, None, |bytes, _, _| {
            progress.push(bytes);
            Ok(())
        })
        .await
        .unwrap();
        assert_eq!(std::fs::read(&destination).unwrap(), b"previous database");
        assert_eq!(std::fs::read(&downloaded.path).unwrap(), b"ABCDEFGH");
        assert!(progress.contains(&4));
        let (part, metadata) = part_paths(&url, &destination);
        downloaded.install(&destination).unwrap();
        assert_eq!(std::fs::read(destination).unwrap(), b"ABCDEFGH");
        assert!(!part.exists() && !metadata.exists());
        task.await.unwrap();
        let requests = requests.lock().unwrap();
        assert!(!requests[0].contains("\r\nrange:"));
        assert!(requests[1].contains("\r\nrange: bytes=4-"));
        assert!(requests[1].contains("\r\nif-range: \"v1\""));
        assert!(requests[1].contains("\r\naccept-encoding: identity"));
    }

    #[tokio::test]
    async fn a_new_invocation_reads_partial_bytes_and_metadata_from_disk() {
        let (url, requests, task) = server(vec![response(
            "206 Partial Content",
            "Content-Length: 4\r\nETag: \"v1\"\r\nContent-Range: bytes 4-7/8\r\n",
            "EFGH",
        )])
        .await;
        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("db.db3");
        seed(&url, &destination, b"ABCD", etag(), Some(8));
        let downloaded = receive(
            "new-invocation",
            &url,
            &destination,
            None,
            None,
            |_, _, _| Ok(()),
        )
        .await
        .unwrap();
        assert_eq!(std::fs::read(&downloaded.path).unwrap(), b"ABCDEFGH");
        task.await.unwrap();
        assert!(requests.lock().unwrap()[0].contains("\r\nrange: bytes=4-"));
    }

    #[tokio::test]
    async fn a_full_response_replaces_instead_of_appending_to_partial_bytes() {
        let (url, requests, task) = server(vec![response(
            "200 OK",
            "Content-Length: 8\r\nETag: \"v2\"\r\n",
            "12345678",
        )])
        .await;
        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("db.db3");
        seed(&url, &destination, b"ABCD", etag(), Some(8));
        let downloaded = receive("test", &url, &destination, None, None, |_, _, _| Ok(()))
            .await
            .unwrap();
        assert_eq!(std::fs::read(&downloaded.path).unwrap(), b"12345678");
        task.await.unwrap();
        assert!(requests.lock().unwrap()[0].contains("\r\nrange: bytes=4-"));
    }

    #[tokio::test]
    async fn changed_etags_or_incorrect_ranges_restart_without_mixing_bytes() {
        for headers in [
            "Content-Length: 4\r\nETag: \"v2\"\r\nContent-Range: bytes 4-7/8\r\n",
            "Content-Length: 4\r\nETag: \"v1\"\r\nContent-Range: bytes 3-6/8\r\n",
            "Content-Length: 4\r\nETag: \"v1\"\r\nContent-Range: bytes 4-7/9\r\n",
        ] {
            let (url, requests, task) = server(vec![
                response("206 Partial Content", headers, "WXYZ"),
                response(
                    "200 OK",
                    "Content-Length: 8\r\nETag: \"v2\"\r\n",
                    "12345678",
                ),
            ])
            .await;
            let directory = tempfile::tempdir().unwrap();
            let destination = directory.path().join("db.db3");
            seed(&url, &destination, b"ABCD", etag(), Some(8));
            let downloaded = receive("test", &url, &destination, None, None, |_, _, _| Ok(()))
                .await
                .unwrap();
            assert_eq!(std::fs::read(&downloaded.path).unwrap(), b"12345678");
            task.await.unwrap();
            let requests = requests.lock().unwrap();
            assert!(requests[0].contains("\r\nrange: bytes=4-"));
            assert!(!requests[1].contains("\r\nrange:"));
        }
    }

    #[tokio::test]
    async fn missing_or_weak_validators_never_resume_unverified_bytes() {
        for validator in [None, Some(Validator::Etag("W/\"v1\"".to_owned()))] {
            let (url, requests, task) = server(vec![response(
                "200 OK",
                "Content-Length: 8\r\n",
                "12345678",
            )])
            .await;
            let directory = tempfile::tempdir().unwrap();
            let destination = directory.path().join("db.db3");
            seed(&url, &destination, b"ABCD", validator, Some(8));
            let downloaded = receive("test", &url, &destination, None, None, |_, _, _| Ok(()))
                .await
                .unwrap();
            assert_eq!(std::fs::read(&downloaded.path).unwrap(), b"12345678");
            task.await.unwrap();
            assert!(!requests.lock().unwrap()[0].contains("\r\nrange:"));
        }
    }

    #[tokio::test]
    async fn invalid_metadata_and_changed_urls_start_fresh() {
        let (url, requests, task) = server(vec![response(
            "200 OK",
            "Content-Length: 8\r\nETag: \"v1\"\r\n",
            "12345678",
        )])
        .await;
        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("db.db3");
        seed(&url, &destination, b"ABCD", etag(), Some(8));
        let (_, sidecar) = part_paths(&url, &destination);
        std::fs::write(sidecar, b"invalid JSON").unwrap();
        let downloaded = receive("test", &url, &destination, None, None, |_, _, _| Ok(()))
            .await
            .unwrap();
        assert_eq!(std::fs::read(&downloaded.path).unwrap(), b"12345678");
        task.await.unwrap();
        assert!(!requests.lock().unwrap()[0].contains("\r\nrange:"));
    }

    #[tokio::test]
    async fn complete_partial_is_accepted_only_with_a_matching_416_validator() {
        let (url, _, task) = server(vec![response(
            "416 Range Not Satisfiable",
            "Content-Length: 0\r\nETag: \"v1\"\r\nContent-Range: bytes */8\r\n",
            "",
        )])
        .await;
        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("db.db3");
        seed(&url, &destination, b"ABCDEFGH", etag(), Some(8));
        let downloaded = receive("test", &url, &destination, None, None, |_, _, _| Ok(()))
            .await
            .unwrap();
        assert_eq!(std::fs::read(&downloaded.path).unwrap(), b"ABCDEFGH");
        task.await.unwrap();
    }

    #[tokio::test]
    async fn cancellation_preserves_bytes_and_allows_a_later_resume() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}/db.db3", listener.local_addr().unwrap());
        let requests = Arc::new(std::sync::Mutex::new(Vec::new()));
        let captured = requests.clone();
        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut request = [0; 4096];
            socket.read(&mut request).await.unwrap();
            socket
                .write_all(
                    response("200 OK", "Content-Length: 8\r\nETag: \"v1\"\r\n", "ABCD").as_bytes(),
                )
                .await
                .unwrap();
            let (mut resumed, _) = listener.accept().await.unwrap();
            let count = resumed.read(&mut request).await.unwrap();
            captured
                .lock()
                .unwrap()
                .push(String::from_utf8_lossy(&request[..count]).to_lowercase());
            resumed
                .write_all(
                    response(
                        "206 Partial Content",
                        "Content-Length: 4\r\nETag: \"v1\"\r\nContent-Range: bytes 4-7/8\r\n",
                        "EFGH",
                    )
                    .as_bytes(),
                )
                .await
                .unwrap();
        });
        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("db.db3");
        let (handle, registration) = futures_util::future::AbortHandle::new_pair();
        let result = futures_util::future::Abortable::new(
            receive("test", &url, &destination, None, None, |bytes, _, _| {
                if bytes == 4 {
                    handle.abort();
                }
                Ok(())
            }),
            registration,
        )
        .await;
        assert!(result.is_err());
        let (part, _) = part_paths(&url, &destination);
        assert_eq!(std::fs::read(part).unwrap(), b"ABCD");
        assert!(!destination.exists());
        let downloaded = receive("test", &url, &destination, None, None, |_, _, _| Ok(()))
            .await
            .unwrap();
        assert_eq!(std::fs::read(&downloaded.path).unwrap(), b"ABCDEFGH");
        server.await.unwrap();
        assert!(requests.lock().unwrap()[0].contains("\r\nrange: bytes=4-"));
    }

    #[tokio::test]
    async fn retry_exhaustion_keeps_partial_data_for_a_manual_retry() {
        let (url, requests, task) = server(vec![
            response("200 OK", "Content-Length: 8\r\nETag: \"v1\"\r\n", "ABCD"),
            response(
                "206 Partial Content",
                "Content-Length: 4\r\nETag: \"v1\"\r\nContent-Range: bytes 4-7/8\r\n",
                "E",
            ),
            response(
                "206 Partial Content",
                "Content-Length: 3\r\nETag: \"v1\"\r\nContent-Range: bytes 5-7/8\r\n",
                "F",
            ),
            response(
                "206 Partial Content",
                "Content-Length: 2\r\nETag: \"v1\"\r\nContent-Range: bytes 6-7/8\r\n",
                "G",
            ),
            response(
                "206 Partial Content",
                "Content-Length: 1\r\nETag: \"v1\"\r\nContent-Range: bytes 7-7/8\r\n",
                "H",
            ),
        ])
        .await;
        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("db.db3");
        assert!(
            receive("test", &url, &destination, None, None, |_, _, _| Ok(()))
                .await
                .is_err()
        );
        let (part, _) = part_paths(&url, &destination);
        assert_eq!(std::fs::read(part).unwrap(), b"ABCDEFG");
        assert!(!destination.exists());
        let downloaded = receive("test", &url, &destination, None, None, |_, _, _| Ok(()))
            .await
            .unwrap();
        assert_eq!(std::fs::read(&downloaded.path).unwrap(), b"ABCDEFGH");
        task.await.unwrap();
        assert_eq!(requests.lock().unwrap().len(), 5);
    }

    #[tokio::test]
    async fn last_modified_is_used_only_when_it_is_a_strong_date_validator() {
        for date in [
            "Sat, 01 Jun 2024 00:00:30 GMT",
            "Sun, 02 Jun 2024 00:00:00 GMT",
        ] {
            let strong = date.starts_with("Sun");
            let first = format!("Content-Length: 8\r\nLast-Modified: Sat, 01 Jun 2024 00:00:00 GMT\r\nDate: {date}\r\n");
            let second = if strong {
                response("206 Partial Content", "Content-Length: 4\r\nLast-Modified: Sat, 01 Jun 2024 00:00:00 GMT\r\nContent-Range: bytes 4-7/8\r\n", "EFGH")
            } else {
                response("200 OK", "Content-Length: 8\r\n", "ABCDEFGH")
            };
            let (url, requests, task) =
                server(vec![response("200 OK", &first, "ABCD"), second]).await;
            let directory = tempfile::tempdir().unwrap();
            let destination = directory.path().join("db.db3");
            let downloaded = receive("test", &url, &destination, None, None, |_, _, _| Ok(()))
                .await
                .unwrap();
            assert_eq!(std::fs::read(&downloaded.path).unwrap(), b"ABCDEFGH");
            task.await.unwrap();
            let requests = requests.lock().unwrap();
            assert_eq!(requests[1].contains("\r\nrange:"), strong);
            if strong {
                assert!(requests[1].contains("\r\nif-range: sat, 01 jun 2024 00:00:00 gmt"));
            }
        }
    }

    #[tokio::test]
    async fn invalid_416_restarts_instead_of_installing_a_truncated_file() {
        let (url, _, task) = server(vec![
            response(
                "416 Range Not Satisfiable",
                "Content-Length: 0\r\nETag: \"v2\"\r\nContent-Range: bytes */4\r\n",
                "",
            ),
            response(
                "200 OK",
                "Content-Length: 8\r\nETag: \"v2\"\r\n",
                "12345678",
            ),
        ])
        .await;
        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("db.db3");
        seed(&url, &destination, b"ABCD", etag(), Some(8));
        let downloaded = receive("test", &url, &destination, None, None, |_, _, _| Ok(()))
            .await
            .unwrap();
        assert_eq!(std::fs::read(&downloaded.path).unwrap(), b"12345678");
        task.await.unwrap();
    }

    #[tokio::test]
    async fn permanent_http_errors_leave_existing_partial_bytes_untouched() {
        let (url, requests, task) =
            server(vec![response("403 Forbidden", "Content-Length: 0\r\n", "")]).await;
        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("db.db3");
        seed(&url, &destination, b"ABCD", etag(), Some(8));
        assert!(
            receive("test", &url, &destination, None, None, |_, _, _| Ok(()))
                .await
                .is_err()
        );
        assert_eq!(
            std::fs::read(part_paths(&url, &destination).0).unwrap(),
            b"ABCD"
        );
        task.await.unwrap();
        assert_eq!(requests.lock().unwrap().len(), 1);
    }

    #[tokio::test]
    async fn a_truncated_chunked_response_resumes_without_an_initial_content_length() {
        let (url, requests, task) = server(vec![
            response(
                "200 OK",
                "Transfer-Encoding: chunked\r\nETag: \"v1\"\r\n",
                "4\r\nABCD\r\n",
            ),
            response(
                "206 Partial Content",
                "Content-Length: 4\r\nETag: \"v1\"\r\nContent-Range: bytes 4-7/8\r\n",
                "EFGH",
            ),
        ])
        .await;
        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("db.db3");
        let downloaded = receive("test", &url, &destination, None, None, |_, _, _| Ok(()))
            .await
            .unwrap();
        assert_eq!(std::fs::read(&downloaded.path).unwrap(), b"ABCDEFGH");
        task.await.unwrap();
        assert!(requests.lock().unwrap()[1].contains("\r\nrange: bytes=4-"));
    }

    #[tokio::test]
    async fn an_encoded_response_is_rejected_before_modifying_partial_bytes() {
        let (url, _, task) = server(vec![response(
            "200 OK",
            "Content-Length: 4\r\nContent-Encoding: gzip\r\n",
            "gzip",
        )])
        .await;
        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("db.db3");
        seed(&url, &destination, b"ABCD", etag(), Some(8));
        assert!(
            receive("test", &url, &destination, None, None, |_, _, _| Ok(()))
                .await
                .is_err()
        );
        assert_eq!(
            std::fs::read(part_paths(&url, &destination).0).unwrap(),
            b"ABCD"
        );
        assert!(!destination.exists());
        task.await.unwrap();
    }

    #[tokio::test]
    async fn cancellation_while_waiting_for_headers_preserves_an_existing_partial() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}/db.db3", listener.local_addr().unwrap());
        let (ready, received) = tokio::sync::oneshot::channel();
        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut request = [0; 4096];
            socket.read(&mut request).await.unwrap();
            ready.send(()).unwrap();
            std::future::pending::<()>().await;
        });
        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("db.db3");
        seed(&url, &destination, b"ABCD", etag(), Some(8));
        let (handle, registration) = futures_util::future::AbortHandle::new_pair();
        let mut transfer = Box::pin(futures_util::future::Abortable::new(
            receive("test", &url, &destination, None, None, |_, _, _| Ok(())),
            registration,
        ));
        tokio::select! {
            result = &mut transfer => panic!("transfer ended before cancellation: {}", result.is_err()),
            result = received => result.unwrap(),
        }
        handle.abort();
        assert!(transfer.await.is_err());
        server.abort();
        assert_eq!(
            std::fs::read(part_paths(&url, &destination).0).unwrap(),
            b"ABCD"
        );
        assert!(!destination.exists());
    }
}
