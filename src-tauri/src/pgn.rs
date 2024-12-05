use std::{
    fs::{File, OpenOptions},
    io::{self, BufRead, BufReader, Read, Seek, SeekFrom, Write},
    path::PathBuf,
};

use crate::{error::Error, AppState};

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

    fn position(&mut self) -> io::Result<u64> {
        self.reader.stream_position()
    }

    fn offset_by_index(&mut self, n: usize, state: &AppState, file: &String) -> io::Result<()> {
        let offset_index = n / GAME_OFFSET_FREQ;
        let n_left = n % GAME_OFFSET_FREQ;
        let pgn_offsets = state.pgn_offsets.get(file).unwrap();

        if offset_index == 0 || offset_index < pgn_offsets.len() {
            let offset = match offset_index {
                0 => self.start,
                _ => pgn_offsets[offset_index - 1],
            };

            self.reader.seek(SeekFrom::Start(offset))?;

            self.skip_games(n_left)?;
        } else {
            self.reader.seek(SeekFrom::Start(self.start))?;
            self.skip_games(n)?;
        }

        Ok(())
    }

    /// Skip n games, and return the number of bytes read
    fn skip_games(&mut self, n: usize) -> io::Result<usize> {
        let mut new_game = false;
        let mut skipped = 0;
        let mut count = 0;

        if n == 0 {
            return Ok(0);
        }

        let mut line = String::new();
        loop {
            let res = self.reader.read_line(&mut line);
            if res.is_err() {
                continue;
            }
            let bytes = res.unwrap();
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

    fn read_game(&mut self) -> io::Result<String> {
        let mut new_game = false;
        self.game.clear();
        loop {
            let res = self.reader.read_line(&mut self.line);
            if res.is_err() {
                continue;
            }
            let bytes = res.unwrap();
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

fn ignore_bom(reader: &mut BufReader<File>) -> io::Result<u64> {
    let mut bom = [0; 3];
    reader.read_exact(&mut bom)?;
    if bom != [0xEF, 0xBB, 0xBF] {
        reader.seek(SeekFrom::Start(0))?;
        return Ok(0);
    }
    Ok(3)
}

#[tauri::command]
#[specta::specta]
pub async fn count_pgn_games(
    file: PathBuf,
    state: tauri::State<'_, AppState>,
) -> Result<i32, Error> {
    let files_string = file.to_string_lossy().to_string();

    let file = File::open(&file)?;

    let mut parser = PgnParser::new(file.try_clone()?);

    let mut offsets = Vec::new();

    let mut count = 0;

    while let Ok(skipped) = parser.skip_games(1) {
        if skipped == 0 {
            break;
        }
        count += 1;
        if count % GAME_OFFSET_FREQ as i32 == 0 {
            let cur_pos = parser.position()?;
            offsets.push(cur_pos);
        }
    }

    state.pgn_offsets.insert(files_string, offsets);
    Ok(count)
}

#[tauri::command]
#[specta::specta]
pub async fn read_games(
    file: PathBuf,
    start: i32,
    end: i32,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<String>, Error> {
    let file_r = File::open(&file)?;

    let mut parser = PgnParser::new(file_r.try_clone()?);

    parser.offset_by_index(start as usize, &state, &file.to_string_lossy().to_string())?;

    let mut games: Vec<String> = Vec::with_capacity((end - start) as usize);

    for _ in start..=end {
        let game = parser.read_game()?;
        if game.is_empty() {
            break;
        }
        games.push(game);
    }
    Ok(games)
}

#[tauri::command]
#[specta::specta]
pub async fn delete_game(
    file: PathBuf,
    n: i32,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let file_r = File::open(&file)?;

    let mut parser = PgnParser::new(file_r.try_clone()?);

    parser.offset_by_index(n as usize, &state, &file.to_string_lossy().to_string())?;

    let starting_bytes = parser.position()?;

    parser.skip_games(1)?;

    let mut file_w = OpenOptions::new().write(true).open(file)?;

    file_w.seek(SeekFrom::Start(starting_bytes))?;

    write_to_end(&mut parser.reader, &mut file_w)?;
    Ok(())
}

fn write_to_end<R: Read>(reader: &mut R, writer: &mut File) -> io::Result<()> {
    io::copy(reader, writer)?;
    let end = writer.stream_position()?;
    writer.set_len(end)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn write_game(
    file: PathBuf,
    n: i32,
    pgn: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    if !file.exists() {
        File::create(&file)?;
    }

    let file_r = File::open(&file)?;
    let mut file_w = OpenOptions::new().write(true).open(&file)?;

    let mut tmpf = tempfile::tempfile()?;
    io::copy(&mut file_r.try_clone()?, &mut tmpf)?;

    let mut parser = PgnParser::new(file_r.try_clone()?);

    parser.offset_by_index(n as usize, &state, &file.to_string_lossy().to_string())?;

    tmpf.seek(SeekFrom::Start(parser.position()?))?;
    tmpf.write_all(pgn.as_bytes())?;

    parser.skip_games(1)?;

    write_to_end(&mut parser.reader, &mut tmpf)?;

    tmpf.seek(SeekFrom::Start(0))?;

    write_to_end(&mut tmpf, &mut file_w)?;

    Ok(())
}
