use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Puzzle {
    pub fen: String,
    pub moves: String,
    pub rating: u32,
    pub rating_deviation: u32,
    pub popularity: u32,
    pub nb_plays: u32,
}

#[tauri::command]
pub fn get_puzzle(file: PathBuf) -> Result<Puzzle, String> {
    let db = rusqlite::Connection::open(&file).expect("open database");
    let mut stmt = db
        .prepare("select * from puzzles where rowid = (abs(random()) % (select (select max(rowid) from puzzles)+1));")
        .expect("prepare");
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    let row = rows.next().map_err(|e| e.to_string())?.unwrap();
    let fen: String = row.get(0).map_err(|e| e.to_string())?;
    let moves: String = row.get(1).map_err(|e| e.to_string())?;
    let rating: u32 = row.get(2).map_err(|e| e.to_string())?;
    let rating_deviation: u32 = row.get(3).map_err(|e| e.to_string())?;
    let popularity: u32 = row.get(4).map_err(|e| e.to_string())?;
    let nb_plays: u32 = row.get(5).map_err(|e| e.to_string())?;

    Ok(Puzzle {
        fen,
        moves,
        rating,
        rating_deviation,
        popularity,
        nb_plays,
    })
}
