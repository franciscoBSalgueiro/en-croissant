//! Durable game snapshots. A committed move never depends on WebView storage.
use crate::{
    error::Error,
    game::{GameConfig, GameState},
};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::{
    fs::{self, File},
    io::Write,
    path::{Path, PathBuf},
};

#[derive(Clone, Debug, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SavedGame {
    pub version: u32,
    pub id: String,
    pub started_at: i64,
    pub updated_at: i64,
    pub config: GameConfig,
    pub state: GameState,
}
#[derive(Clone)]
pub struct GameArchive {
    pub directory: PathBuf,
    pub id: String,
    pub started_at: i64,
}
impl GameArchive {
    pub fn new(directory: PathBuf) -> Self {
        Self {
            directory,
            id: format!("{:032x}", rand::random::<u128>()),
            started_at: chrono::Utc::now().timestamp_millis(),
        }
    }
    pub fn save(&self, config: &GameConfig, state: GameState) -> Result<(), Error> {
        let record = SavedGame {
            version: 1,
            id: self.id.clone(),
            started_at: self.started_at,
            updated_at: chrono::Utc::now().timestamp_millis(),
            config: config.clone(),
            state,
        };
        write_snapshot(&self.directory, &record).map_err(|error| Error::GameSave(error.to_string()))
    }
}
fn path(directory: &Path, id: &str) -> Result<PathBuf, Error> {
    if id.len() != 32 || !id.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(
            std::io::Error::new(std::io::ErrorKind::InvalidInput, "Invalid saved game ID").into(),
        );
    }
    Ok(directory.join(format!("{id}.json")))
}
fn write_snapshot(directory: &Path, record: &SavedGame) -> Result<(), Error> {
    fs::create_dir_all(directory)?;
    let mut temporary = tempfile::NamedTempFile::new_in(directory)?;
    serde_json::to_writer(&mut temporary, record).map_err(std::io::Error::other)?;
    temporary.flush()?;
    temporary.as_file().sync_all()?;
    temporary
        .persist(path(directory, &record.id)?)
        .map_err(|error| error.error)?;
    #[cfg(unix)]
    File::open(directory)?.sync_all()?;
    Ok(())
}
pub fn load(directory: &Path, id: &str) -> Result<SavedGame, Error> {
    let record: SavedGame = serde_json::from_reader(File::open(path(directory, id)?)?)
        .map_err(std::io::Error::other)?;
    if record.version != 1 || record.id != id {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Unsupported or invalid saved game",
        )
        .into());
    }
    Ok(record)
}
pub fn list(directory: &Path) -> Result<Vec<SavedGame>, Error> {
    if !directory.exists() {
        return Ok(Vec::new());
    }
    let mut records = Vec::new();
    for entry in fs::read_dir(directory)? {
        let entry = entry?;
        if entry.path().extension().is_some_and(|ext| ext == "json") {
            let id = entry
                .path()
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned();
            // Surface corrupt records rather than silently presenting an empty history.
            records.push(load(directory, &id)?);
        }
    }
    records.sort_by_key(|record| std::cmp::Reverse(record.updated_at));
    Ok(records)
}
