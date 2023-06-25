use std::{
    fs::{File, OpenOptions},
    io::{BufRead, BufReader, Read, Seek, SeekFrom, Write},
    path::PathBuf,
};

use crate::AppState;

const GAME_OFFSET_FREQ: i64 = 2;

struct PgnParser {
    reader: BufReader<File>,
    line: String,
    game: String,
}

impl PgnParser {
    fn new(file: File) -> Self {
        let mut reader = BufReader::new(file);
        ignore_bom(&mut reader).unwrap();
        Self {
            reader,
            line: String::new(),
            game: String::new(),
        }
    }

    fn skip_games(&mut self, n: i64) -> std::io::Result<()> {
        let mut new_game = false;
        let mut count = 0;

        dbg!(n);

        if n == 0 {
            return Ok(());
        }

        let mut line = String::new();
        while let Ok(bytes) = self.reader.read_line(&mut line) {
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
        Ok(())
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

fn ignore_bom(reader: &mut BufReader<File>) -> std::io::Result<()> {
    let mut bom = [0; 3];
    reader.read_exact(&mut bom)?;
    if bom != [0xEF, 0xBB, 0xBF] {
        reader.seek(SeekFrom::Start(0))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn count_pgn_games(
    file: PathBuf,
    state: tauri::State<'_, AppState>,
) -> Result<i64, String> {
    let files_string = file.to_string_lossy().to_string();
    if let Some(count) = state.pgn_counts.get(&files_string) {
        return Ok(*count);
    }
    let file = File::open(&file).or(Err(format!(
        "Failed to open pgn file: {}",
        file.to_str().unwrap()
    )))?;

    let mut reader = BufReader::new(file.try_clone().unwrap());
    ignore_bom(&mut reader).unwrap();

    let mut offsets = Vec::new();

    let mut count: i64 = 0;
    let mut new_game = true;

    let mut line = String::new();
    loop {
        if let Ok(bytes) = reader.read_line(&mut line) {
            if bytes == 0 {
                break;
            }

            if line.starts_with('[') {
                if new_game {
                    count += 1;
                    if count % GAME_OFFSET_FREQ == 0 {
                        let cur_pos = reader.stream_position().unwrap();
                        println!("adding game {} on {}", count, cur_pos - bytes as u64);
                        offsets.push(cur_pos - bytes as u64);
                    }
                    new_game = false;
                }
            } else {
                new_game = true;
            }
            line.clear();
        } else {
            continue;
        }
    }
    state.pgn_offsets.insert(files_string.clone(), offsets);
    state.pgn_counts.insert(files_string, count);

    Ok(count)
}

#[tauri::command]
pub async fn read_games(
    file: PathBuf,
    start: i64,
    end: i64,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let offset_index = (start / GAME_OFFSET_FREQ) as usize;
    let n_left = start % GAME_OFFSET_FREQ;

    let offset = match offset_index {
        0 => 0,
        _ => state
            .pgn_offsets
            .get(&file.to_string_lossy().to_string())
            .unwrap()[offset_index - 1],
    };

    let game = read_games_from_offset(file, offset, n_left, (end - start) + 1)?;
    Ok(game)
}

#[tauri::command]
pub async fn delete_game(
    file: PathBuf,
    n: i64,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let offset_index = (n / GAME_OFFSET_FREQ) as usize;
    let n_left = n % GAME_OFFSET_FREQ;

    let offset = match offset_index {
        0 => 0,
        _ => state
            .pgn_offsets
            .get(&file.to_string_lossy().to_string())
            .unwrap()[offset_index - 1],
    };

    dbg!(offset);
    dbg!(n_left);

    let file_r = File::open(&file).or(Err(format!(
        "Failed to open pgn file: {}",
        file.to_str().unwrap()
    )))?;

    println!("deleting game {}", n);

    let mut parser = PgnParser::new(file_r.try_clone().unwrap());

    parser.skip_games(n).unwrap();

    let starting_bytes = parser.reader.stream_position().unwrap();

    dbg!(starting_bytes);

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

/// Reads n games and returns the number of bytes read
fn skip_games(reader: &mut BufReader<File>, n: i64) -> std::io::Result<()> {
    let mut new_game = false;
    let mut count = 0;

    dbg!(n);

    if n == 0 {
        return Ok(());
    }

    let mut line = String::new();
    while let Ok(bytes) = reader.read_line(&mut line) {
        if bytes == 0 {
            break;
        }
        if line.starts_with('[') {
            if new_game {
                count += 1;
                if count == n {
                    reader.seek(SeekFrom::Current(-(bytes as i64)))?;
                    break;
                }
                new_game = false;
            }
        } else {
            new_game = true;
        }
        line.clear();
    }
    Ok(())
}

fn read_games_from_offset(
    path: PathBuf,
    offset: u64,
    n_left: i64,
    count: i64,
) -> Result<Vec<String>, String> {
    let file = File::open(&path).unwrap();
    let mut reader = BufReader::new(file);
    reader.seek(SeekFrom::Start(offset)).unwrap();
    let mut games: Vec<String> = Vec::with_capacity(count as usize);
    ignore_bom(&mut reader).unwrap();
    let mut game = String::new();
    let mut new_game = true;
    let mut line = String::new();
    let mut n: i64 = 0;
    loop {
        if let Ok(bytes) = reader.read_line(&mut line) {
            if bytes == 0 {
                games.push(std::mem::take(&mut game));
                break;
            }
            if line.starts_with('[') {
                if new_game {
                    if n > n_left {
                        games.push(std::mem::take(&mut game));
                    }
                    if n == n_left + count {
                        break;
                    }
                    n += 1;
                    new_game = false;
                }
            } else {
                new_game = true;
            }
            if n > n_left {
                game.push_str(&line);
            }
            line.clear();
        } else {
            continue;
        }
    }
    Ok(games)
}
