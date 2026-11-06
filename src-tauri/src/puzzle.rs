use std::{
    collections::VecDeque,
    fs::remove_file,
    path::{Path, PathBuf},
    sync::Mutex,
};

use duckdb::{params, AccessMode, Config, Connection};
use once_cell::sync::Lazy;
use serde::Serialize;
use specta::Type;

use crate::{db::Puzzle, error::Error};

fn is_legacy_database(path: &Path) -> Result<bool, std::io::Error> {
    let mut header = [0; 16];
    std::io::Read::read_exact(&mut std::fs::File::open(path)?, &mut header)?;
    Ok(&header == b"SQLite format 3\0")
}

fn open_database(path: &Path) -> Result<Connection, Error> {
    if is_legacy_database(path)? {
        return Err(std::io::Error::other(
            "This puzzle database uses the old SQLite format. Download the latest DuckDB puzzle database.",
        ).into());
    }
    match Connection::open_with_flags(path, Config::default().access_mode(AccessMode::ReadOnly)?) {
        Ok(db) => Ok(db),
        // Some platforms (iOS sandbox) refuse the read-only lock; a normal open works there.
        Err(read_only_error) => Connection::open(path).map_err(|_| read_only_error.into()),
    }
}

static PUZZLE_CACHE: Lazy<Mutex<PuzzleCache>> = Lazy::new(|| Mutex::new(PuzzleCache::new()));

#[derive(Debug)]
struct PuzzleCache {
    cache: VecDeque<Puzzle>,
    file: String,
    min_rating: u16,
    max_rating: u16,
    theme: Option<String>,
}

impl PuzzleCache {
    fn new() -> Self {
        Self {
            cache: VecDeque::new(),
            file: String::new(),
            min_rating: 0,
            max_rating: 0,
            theme: None,
        }
    }

    fn get_puzzles(
        &mut self,
        file: &str,
        min_rating: u16,
        max_rating: u16,
        theme: &Option<String>,
    ) -> Result<(), Error> {
        if self.cache.is_empty()
            || self.min_rating != min_rating
            || self.max_rating != max_rating
            || self.theme != *theme
            || self.file != file
        {
            self.cache.clear();
            let db = open_database(Path::new(file))?;
            let mut query = String::from(
                "SELECT p.id, p.fen, p.moves, p.rating, p.rating_deviation, p.popularity, p.nb_plays
                 FROM puzzles p WHERE p.rating BETWEEN ? AND ?",
            );
            if theme.is_some() {
                query.push_str(
                    " AND EXISTS (SELECT 1 FROM puzzle_themes pt
                      JOIN themes t ON t.id = pt.theme_id
                      WHERE pt.puzzle_id = p.id AND t.name = ?)",
                );
            }
            query.push_str(" ORDER BY random() LIMIT 20");
            let mut statement = db.prepare(&query)?;
            let read_puzzle = |row: &duckdb::Row<'_>| {
                Ok(Puzzle {
                    id: row.get(0)?,
                    fen: row.get(1)?,
                    moves: row.get(2)?,
                    rating: row.get(3)?,
                    rating_deviation: row.get(4)?,
                    popularity: row.get(5)?,
                    nb_plays: row.get(6)?,
                })
            };
            let rows = if let Some(theme_name) = theme {
                statement.query_map(
                    params![i32::from(min_rating), i32::from(max_rating), theme_name],
                    read_puzzle,
                )?
            } else {
                statement.query_map(
                    params![i32::from(min_rating), i32::from(max_rating)],
                    read_puzzle,
                )?
            };
            self.cache = rows.collect::<Result<_, _>>()?;
            self.file = file.to_owned();
            self.min_rating = min_rating;
            self.max_rating = max_rating;
            self.theme = theme.clone();
        }

        Ok(())
    }

    fn get_next_puzzle(&mut self) -> Option<Puzzle> {
        self.cache.pop_front()
    }
}

#[tauri::command]
#[specta::specta]
pub fn get_puzzle(
    file: String,
    min_rating: u16,
    max_rating: u16,
    theme: Option<String>,
) -> Result<Puzzle, Error> {
    let mut cache = PUZZLE_CACHE.lock().unwrap();
    cache.get_puzzles(&file, min_rating, max_rating, &theme)?;
    cache.get_next_puzzle().ok_or(Error::NoPuzzles)
}

#[derive(Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PuzzleDatabaseInfo {
    title: String,
    description: String,
    puzzle_count: i32,
    storage_size: u64,
    path: String,
}

#[tauri::command]
#[specta::specta]
pub async fn get_puzzle_db_info(file: PathBuf) -> Result<Option<PuzzleDatabaseInfo>, Error> {
    database_info(file)
}

fn database_info(path: PathBuf) -> Result<Option<PuzzleDatabaseInfo>, Error> {
    match is_legacy_database(&path) {
        // The published puzzle database (encroissant.org) is still in the old
        // SQLite format: convert it once instead of deleting the download.
        Ok(true) => convert_legacy_puzzles(&path)?,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.into()),
        Ok(false) => {}
    }
    if path.is_dir() {
        return Err(std::io::Error::other(
            "Der Download ist ein Ordner (entpacktes Archiv), keine Datenbank-Datei.",
        )
        .into());
    }
    let db = open_database(&path)?;
    let puzzle_count = db.query_row("SELECT COUNT(*) FROM puzzles", [], |row| row.get(0))?;

    let storage_size = path.metadata()?.len();
    let filename = path.file_name().expect("get filename").to_string_lossy();

    Ok(Some(PuzzleDatabaseInfo {
        title: filename.to_string(),
        description: "".to_string(),
        puzzle_count,
        storage_size,
        path: path.to_string_lossy().to_string(),
    }))
}

static CONVERSION_LOCK: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));

/// Rewrites an old SQLite puzzle database as DuckDB, in place (same file name).
fn convert_legacy_puzzles(path: &Path) -> Result<(), Error> {
    let _guard = CONVERSION_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    // Another caller may have converted it while we waited.
    if !is_legacy_database(path)? {
        return Ok(());
    }
    log::info!("Converting legacy puzzle database {}", path.display());

    let temp = PathBuf::from(format!("{}.converting", path.display()));
    let _ = std::fs::remove_file(&temp);
    let _ = std::fs::remove_file(format!("{}.wal", temp.display()));

    let result = (|| -> Result<(), Error> {
        let source = rusqlite::Connection::open_with_flags(
            path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
        )
        .map_err(|e| std::io::Error::other(format!("SQLite: {e}")))?;
        let sqlite = |e: rusqlite::Error| std::io::Error::other(format!("SQLite: {e}"));

        let dest = Connection::open(&temp)?;
        dest.execute_batch(
            "CREATE TABLE puzzles (id INTEGER, fen VARCHAR, moves VARCHAR, rating INTEGER,
                rating_deviation INTEGER, popularity INTEGER, nb_plays INTEGER);
             CREATE TABLE themes (id INTEGER, name VARCHAR);
             CREATE TABLE puzzle_themes (puzzle_id INTEGER, theme_id INTEGER);",
        )?;

        {
            let mut appender = dest.appender("puzzles")?;
            let mut stmt = source
                .prepare(
                    "SELECT id, fen, moves, rating, rating_deviation, popularity, nb_plays
                     FROM puzzles",
                )
                .map_err(sqlite)?;
            let mut rows = stmt.query([]).map_err(sqlite)?;
            while let Some(row) = rows.next().map_err(sqlite)? {
                let id: i32 = row.get(0).map_err(sqlite)?;
                let fen: String = row.get(1).map_err(sqlite)?;
                let moves: String = row.get(2).map_err(sqlite)?;
                let rating: i32 = row.get(3).map_err(sqlite)?;
                let deviation: i32 = row.get(4).map_err(sqlite)?;
                let popularity: i32 = row.get(5).map_err(sqlite)?;
                let plays: i32 = row.get(6).map_err(sqlite)?;
                appender.append_row(params![id, fen, moves, rating, deviation, popularity, plays])?;
            }
            appender.flush()?;
        }

        // Older files have no themes.
        let has_themes: bool = source
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'puzzle_themes'",
                [],
                |r| r.get::<_, i64>(0),
            )
            .map_err(sqlite)?
            > 0;
        if has_themes {
            let mut appender = dest.appender("themes")?;
            let mut stmt = source.prepare("SELECT id, name FROM themes").map_err(sqlite)?;
            let mut rows = stmt.query([]).map_err(sqlite)?;
            while let Some(row) = rows.next().map_err(sqlite)? {
                let id: i32 = row.get(0).map_err(sqlite)?;
                let name: String = row.get(1).map_err(sqlite)?;
                appender.append_row(params![id, name])?;
            }
            appender.flush()?;
            drop(appender);

            let mut appender = dest.appender("puzzle_themes")?;
            let mut stmt = source
                .prepare("SELECT puzzle_id, theme_id FROM puzzle_themes")
                .map_err(sqlite)?;
            let mut rows = stmt.query([]).map_err(sqlite)?;
            while let Some(row) = rows.next().map_err(sqlite)? {
                let puzzle: i32 = row.get(0).map_err(sqlite)?;
                let theme: i32 = row.get(1).map_err(sqlite)?;
                appender.append_row(params![puzzle, theme])?;
            }
            appender.flush()?;
        }
        dest.execute_batch("CHECKPOINT")?;
        Ok(())
    })();

    if let Err(error) = result {
        let _ = std::fs::remove_file(&temp);
        let _ = std::fs::remove_file(format!("{}.wal", temp.display()));
        return Err(error);
    }
    std::fs::rename(&temp, path)?;
    log::info!("Converted puzzle database {}", path.display());
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn delete_puzzle_database(file: String) -> Result<(), Error> {
    let mut cache = PUZZLE_CACHE.lock().unwrap();
    match remove_file(&file) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(error.into()),
    }
    if cache.file == file {
        cache.cache.clear();
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn get_puzzle_themes(file: String) -> Result<Vec<String>, Error> {
    let db = open_database(Path::new(&file))?;
    let mut statement = db.prepare("SELECT name FROM themes ORDER BY name")?;
    let result = statement
        .query_map([], |row| row.get(0))?
        .collect::<Result<_, _>>()?;
    Ok(result)
}

#[tauri::command]
#[specta::specta]
pub fn get_themes_for_puzzle(file: String, puzzle_id: i32) -> Result<Vec<String>, Error> {
    let db = open_database(Path::new(&file))?;
    let mut statement = db.prepare(
        "SELECT t.name FROM themes t JOIN puzzle_themes pt ON t.id = pt.theme_id
         WHERE pt.puzzle_id = ? ORDER BY t.name",
    )?;
    let result = statement
        .query_map([puzzle_id], |row| row.get(0))?
        .collect::<Result<_, _>>()?;
    Ok(result)
}
