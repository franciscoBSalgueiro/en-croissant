use std::{
    fs::{File, OpenOptions},
    io::{BufRead, BufReader, Read, Seek, SeekFrom, Write},
    path::PathBuf,
};

use crate::AppState;

const GAME_OFFSET_FREQ: usize = 100;

struct PgnParser {
    reader: BufReader<File>,
    line: String,
    game: String,
    start: u64,
}

impl PgnParser {
    fn new(file: File) -> Self {
        let mut reader = BufReader::new(file);
        let start = ignore_bom(&mut reader).unwrap_or(0);
        Self {
            reader,
            line: String::new(),
            game: String::new(),
            start,
        }
    }

    fn offset_by_index(
        &mut self,
        n: usize,
        state: &AppState,
        file: &String,
    ) -> std::io::Result<()> {
        let offset_index = n / GAME_OFFSET_FREQ;
        let n_left = n % GAME_OFFSET_FREQ;

        let offset = match offset_index {
            0 => self.start,
            _ => state.pgn_offsets.get(file).unwrap()[offset_index - 1],
        };

        self.reader.seek(SeekFrom::Start(offset))?;

        self.skip_games(n_left)?;
        Ok(())
    }

    /// Skip n games, and return the number of bytes read
    fn skip_games(&mut self, n: usize) -> std::io::Result<usize> {
        let mut new_game = false;
        let mut skipped = 0;
        let mut count = 0;

        if n == 0 {
            return Ok(0);
        }

        let mut line = String::new();
        while let Ok(bytes) = self.reader.read_line(&mut line) {
            skipped += bytes;
            if bytes == 0 {
                break;
            }
            if line.starts_with('[') {
                if new_game {
                    count += 1;
                    if count == n {
                        self.reader.seek(SeekFrom::Current(-(bytes as i64)))?;
                        break;
                    }
                    new_game = false;
                }
            } else {
                new_game = true;
            }
            line.clear();
        }
        Ok(skipped)
    }

    fn read_game(&mut self) -> std::io::Result<String> {
        let mut new_game = false;
        self.game.clear();
        while let Ok(bytes) = self.reader.read_line(&mut self.line) {
            if bytes == 0 {
                break;
            }
            if self.line.starts_with('[') {
                if new_game {
                    break;
                }
            } else {
                new_game = true;
            }
            self.game.push_str(&self.line);
            self.line.clear();
        }
        Ok(self.game.clone())
    }
}

fn ignore_bom(reader: &mut BufReader<File>) -> std::io::Result<u64> {
    let mut bom = [0; 3];
    reader.read_exact(&mut bom)?;
    if bom != [0xEF, 0xBB, 0xBF] {
        reader.seek(SeekFrom::Start(0))?;
        return Ok(0);
    }
    Ok(3)
}

#[tauri::command]
pub async fn count_pgn_games(
    file: PathBuf,
    state: tauri::State<'_, AppState>,
) -> Result<usize, String> {
    let files_string = file.to_string_lossy().to_string();
    if let Some(count) = state.pgn_counts.get(&files_string) {
        return Ok(*count);
    }
    let file = File::open(&file).or(Err(format!(
        "Failed to open pgn file: {}",
        file.to_str().unwrap()
    )))?;

    let mut parser = PgnParser::new(file.try_clone().unwrap());

    let mut offsets = Vec::new();

    let mut count = 0;

    while let Ok(skipped) = parser.skip_games(1) {
        if skipped == 0 {
            break;
        }
        count += 1;
        if count % GAME_OFFSET_FREQ == 0 {
            let cur_pos = parser.reader.stream_position().unwrap();
            offsets.push(cur_pos);
        }
    }

    state.pgn_offsets.insert(files_string.clone(), offsets);
    state.pgn_counts.insert(files_string, count);
    Ok(count)
}

#[tauri::command]
pub async fn read_games(
    file: PathBuf,
    start: usize,
    end: usize,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let file_r = File::open(&file).unwrap();

    let mut parser = PgnParser::new(file_r.try_clone().unwrap());

    parser
        .offset_by_index(start, &state, &file.to_string_lossy().to_string())
        .unwrap();

    let mut games: Vec<String> = Vec::with_capacity(end - start);

    for _ in start..=end {
        games.push(parser.read_game().unwrap());
    }
    Ok(games)
}

#[tauri::command]
pub async fn delete_game(
    file: PathBuf,
    n: usize,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let file_r = File::open(&file).or(Err(format!(
        "Failed to open pgn file: {}",
        file.to_str().unwrap()
    )))?;

    let mut parser = PgnParser::new(file_r.try_clone().unwrap());

    parser
        .offset_by_index(n, &state, &file.to_string_lossy().to_string())
        .unwrap();

    let starting_bytes = parser.reader.stream_position().unwrap();

    parser.skip_games(1).unwrap();

    let mut file_w = OpenOptions::new().write(true).open(file).unwrap();

    file_w.seek(SeekFrom::Start(starting_bytes)).unwrap();

    // write the rest of the file until the end
    let mut buf = [0; 1024];
    loop {
        let bytes = parser.reader.read(&mut buf).unwrap();
        if bytes == 0 {
            break;
        }
        file_w.write_all(&buf[..bytes]).unwrap();
    }
    let end = file_w.stream_position().unwrap();
    file_w.set_len(end).unwrap();
    Ok(())
}
