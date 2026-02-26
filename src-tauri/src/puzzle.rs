use std::{collections::VecDeque, fs::remove_file, path::PathBuf, sync::Mutex};

use diesel::{dsl::sql, sql_types::Bool, Connection, ExpressionMethods, QueryDsl, RunQueryDsl};
use once_cell::sync::Lazy;
use serde::Serialize;
use specta::Type;
use tauri::{path::BaseDirectory, Manager};

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
        theme: &Option<String>,
    ) -> Result<(), Error> {
        if self.cache.is_empty()
            || self.min_rating != min_rating
            || self.max_rating != max_rating
            || self.theme != *theme
            || self.counter >= 20
        {
            self.cache.clear();
            self.counter = 0;

            let mut db = diesel::SqliteConnection::establish(file).expect("open database");

            let new_puzzles: Vec<Puzzle> = if let Some(theme_name) = theme {
                puzzles::table
                    .inner_join(puzzle_themes::table.inner_join(themes::table))
                    .filter(themes::name.eq(theme_name))
                    .filter(puzzles::rating.le(max_rating as i32))
                    .filter(puzzles::rating.ge(min_rating as i32))
                    .select(puzzles::all_columns)
                    .order(sql::<Bool>("RANDOM()"))
                    .limit(20)
                    .load::<Puzzle>(&mut db)?
            } else {
                puzzles::table
                    .filter(puzzles::rating.le(max_rating as i32))
                    .filter(puzzles::rating.ge(min_rating as i32))
                    .order(sql::<Bool>("RANDOM()"))
                    .limit(20)
                    .load::<Puzzle>(&mut db)?
            };

            self.cache = new_puzzles.into_iter().collect();
            self.min_rating = min_rating;
            self.max_rating = max_rating;
            self.theme = theme.clone();
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
    file: String,
    min_rating: u16,
    max_rating: u16,
    theme: Option<String>,
) -> Result<Puzzle, Error> {
    static PUZZLE_CACHE: Lazy<Mutex<PuzzleCache>> = Lazy::new(|| Mutex::new(PuzzleCache::new()));

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
pub async fn get_puzzle_db_info(
    file: PathBuf,
    app: tauri::AppHandle,
) -> Result<PuzzleDatabaseInfo, Error> {
    let db_path = PathBuf::from("puzzles").join(file);

    let path = app.path().resolve(db_path, BaseDirectory::AppData)?;

    let mut db =
        diesel::SqliteConnection::establish(&path.to_string_lossy()).expect("open database");

    let puzzle_count = puzzles::table.count().get_result::<i64>(&mut db)? as i32;

    let storage_size = path.metadata()?.len();
    let filename = path.file_name().expect("get filename").to_string_lossy();

    Ok(PuzzleDatabaseInfo {
        title: filename.to_string(),
        description: "".to_string(),
        puzzle_count,
        storage_size,
        path: path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
#[specta::specta]
pub fn delete_puzzle_database(file: String) -> Result<(), Error> {
    remove_file(&file)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn get_puzzle_themes(file: String) -> Result<Vec<String>, Error> {
    let mut db = diesel::SqliteConnection::establish(&file).expect("open database");
    let result: Vec<String> = themes::table
        .select(themes::name)
        .order(themes::name.asc())
        .load(&mut db)?;
    Ok(result)
}

#[tauri::command]
#[specta::specta]
pub fn get_themes_for_puzzle(file: String, puzzle_id: i32) -> Result<Vec<String>, Error> {
    let mut db = diesel::SqliteConnection::establish(&file).expect("open database");
    let result: Vec<String> = themes::table
        .inner_join(puzzle_themes::table)
        .filter(puzzle_themes::puzzle_id.eq(puzzle_id))
        .select(themes::name)
        .order(themes::name.asc())
        .load(&mut db)?;
    Ok(result)
}
