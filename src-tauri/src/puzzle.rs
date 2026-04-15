use std::{collections::VecDeque, fs::remove_file, path::PathBuf, sync::Mutex};

use diesel::{dsl::sql, sql_types::Bool, Connection, ExpressionMethods, QueryDsl, RunQueryDsl};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::Manager;

use crate::{
    db::{puzzle_themes, puzzles, themes, Puzzle},
    error::Error,
};

#[derive(Debug)]
struct PuzzleCache {
    cache: VecDeque<Puzzle>,
    counter: usize,
    min_rating: u16,
    max_rating: u16,
    theme: Option<String>,
}

impl PuzzleCache {
    fn new() -> Self {
        Self {
            cache: VecDeque::new(),
            counter: 0,
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
        theme: Option<String>,
    ) -> Result<(), Error> {
        if self.cache.is_empty()
            || self.min_rating != min_rating
            || self.max_rating != max_rating
            || self.theme != theme
            || self.counter >= 20
        {
            self.cache.clear();
            self.counter = 0;

            let mut db = diesel::SqliteConnection::establish(file).expect("open database");

            let new_puzzles: Vec<Puzzle> = if let Some(ref theme_name) = theme {
                puzzles::table
                    .inner_join(puzzle_themes::table.inner_join(themes::table))
                    .filter(themes::name.eq(theme_name))
                    .filter(puzzles::rating.le(i32::from(max_rating)))
                    .filter(puzzles::rating.ge(i32::from(min_rating)))
                    .select(puzzles::all_columns)
                    .order(sql::<Bool>("RANDOM()"))
                    .limit(20)
                    .load::<Puzzle>(&mut db)?
            } else {
                puzzles::table
                    .filter(puzzles::rating.le(i32::from(max_rating)))
                    .filter(puzzles::rating.ge(i32::from(min_rating)))
                    .order(sql::<Bool>("RANDOM()"))
                    .limit(20)
                    .load::<Puzzle>(&mut db)?
            };

            self.cache = new_puzzles.into_iter().collect();
            self.min_rating = min_rating;
            self.max_rating = max_rating;
            self.theme = theme;
        }

        Ok(())
    }

    fn get_next_puzzle(&mut self) -> Option<Puzzle> {
        if let Some(puzzle) = self.cache.get(self.counter) {
            self.counter += 1;
            Some(puzzle.clone())
        } else {
            None
        }
    }
}

#[tauri::command]
#[specta::specta]
pub fn get_puzzle(
    file: PathBuf,
    min_rating: u16,
    max_rating: u16,
    theme: Option<String>,
) -> Result<Puzzle, Error> {
    static PUZZLE_CACHE: std::sync::LazyLock<Mutex<PuzzleCache>> =
        std::sync::LazyLock::new(|| Mutex::new(PuzzleCache::new()));

    let path = file;
    let mut cache = PUZZLE_CACHE.lock().unwrap();
    cache.get_puzzles(
        path.to_str().expect("UTF-8 path"),
        min_rating,
        max_rating,
        theme,
    )?;
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
pub async fn get_puzzle_db_info(file: PathBuf) -> Result<PuzzleDatabaseInfo, Error> {
    let path = file;

    let mut db =
        diesel::SqliteConnection::establish(&path.to_string_lossy()).expect("open database");

    let puzzle_count = i32::try_from(
        puzzles::table
            .count()
            .get_result::<i64>(&mut db)?,
    )
    .unwrap_or(i32::MAX);

    let storage_size = path.metadata()?.len();
    let filename = path.file_name().expect("get filename").to_string_lossy();

    Ok(PuzzleDatabaseInfo {
        title: filename.to_string(),
        description: String::new(),
        puzzle_count,
        storage_size,
        path: path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
#[specta::specta]
pub fn delete_puzzle_database(file: PathBuf) -> Result<(), Error> {
    let path = file;
    remove_file(path)?;
    Ok(())
}

/// A puzzle enriched with session state (completion, time, themes).
/// Stored in `puzzle-sessions.json` in the app data directory.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SessionPuzzle {
    pub id: i32,
    pub fen: String,
    pub moves: Vec<String>,
    pub rating: i32,
    pub rating_deviation: f64,
    pub popularity: i32,
    pub nb_plays: i32,
    pub completion: String,
    pub time_spent: Option<i64>,
    pub themes: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SavedPuzzleSession {
    pub id: String,
    pub name: String,
    pub saved_at: i64,
    pub puzzles: Vec<SessionPuzzle>,
    pub current_puzzle: usize,
    pub db_path: Option<String>,
}

#[tauri::command]
#[specta::specta]
pub fn get_puzzle_sessions(app: tauri::AppHandle) -> Result<Vec<SavedPuzzleSession>, Error> {
    let file = app.path().app_data_dir()?.join("puzzle-sessions.json");
    drop(app);
    if !file.exists() {
        return Ok(vec![]);
    }
    let content = std::fs::read_to_string(file)?;
    Ok(serde_json::from_str(&content)?)
}

#[tauri::command]
#[specta::specta]
pub fn set_puzzle_sessions(
    app: tauri::AppHandle,
    sessions: Vec<SavedPuzzleSession>,
) -> Result<(), Error> {
    let file = app.path().app_data_dir()?.join("puzzle-sessions.json");
    drop(app);
    let json = serde_json::to_string_pretty(&sessions)?;
    drop(sessions);
    std::fs::write(file, json)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn get_puzzle_themes(file: PathBuf) -> Result<Vec<String>, Error> {
    let path = file;
    let mut db =
        diesel::SqliteConnection::establish(path.to_str().expect("UTF-8 path")).expect("open database");
    let result: Vec<String> = themes::table
        .select(themes::name)
        .order(themes::name.asc())
        .load(&mut db)?;
    Ok(result)
}

#[tauri::command]
#[specta::specta]
pub fn get_themes_for_puzzle(file: PathBuf, puzzle_id: i32) -> Result<Vec<String>, Error> {
    let path = file;
    let mut db =
        diesel::SqliteConnection::establish(path.to_str().expect("UTF-8 path")).expect("open database");
    let result: Vec<String> = themes::table
        .inner_join(puzzle_themes::table)
        .filter(puzzle_themes::puzzle_id.eq(puzzle_id))
        .select(themes::name)
        .order(themes::name.asc())
        .load(&mut db)?;
    Ok(result)
}
