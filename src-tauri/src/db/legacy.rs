//! Read the released SQLite format without ever modifying the source database.
use super::{annotations, legacy_encoding, pgn, DatabaseInfo};
use crate::error::Error;
use duckdb::{appender_params_from_iter, params, Connection};
use rusqlite::{Connection as Sqlite, OpenFlags, OptionalExtension};
use std::{
    collections::BTreeMap,
    fs::File,
    io::Read,
    path::{Path, PathBuf},
    time::Instant,
};
use tauri::Emitter;

fn invalid(message: impl Into<String>) -> Error {
    std::io::Error::new(std::io::ErrorKind::InvalidData, message.into()).into()
}

fn sqlite_error(error: rusqlite::Error) -> Error {
    invalid(format!("Legacy database: {error}"))
}

pub(super) fn is_sqlite(path: &Path) -> Result<bool, Error> {
    let mut header = [0; 16];
    let mut file = File::open(path)?;
    match file.read_exact(&mut header) {
        Ok(()) => Ok(&header == b"SQLite format 3\0"),
        Err(error) if error.kind() == std::io::ErrorKind::UnexpectedEof => Ok(false),
        Err(error) => Err(error.into()),
    }
}

fn open(path: &Path) -> Result<Sqlite, Error> {
    Sqlite::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(sqlite_error)
}

fn info(db: &Sqlite, key: &str) -> Result<Option<String>, Error> {
    db.query_row("SELECT Value FROM Info WHERE Name = ?", [key], |row| {
        row.get(0)
    })
    .optional()
    .map(|value| value.flatten())
    .map_err(sqlite_error)
}

pub(super) fn database_info(path: &Path) -> Result<DatabaseInfo, Error> {
    let db = open(path)?;
    let count = |table: &str| -> Result<i32, Error> {
        db.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
            row.get(0)
        })
        .map_err(sqlite_error)
    };
    let filename = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned();
    Ok(DatabaseInfo {
        needs_conversion: true,
        title: info(&db, "Title")?.unwrap_or_else(|| filename.clone()),
        description: info(&db, "Description")?.unwrap_or_default(),
        game_count: count("Games")?,
        player_count: count("Players")?,
        event_count: count("Events")?,
        storage_size: path.metadata()?.len(),
        filename,
    })
}

fn game_pgn(row: &rusqlite::Row<'_>) -> Result<String, Error> {
    let mut tags = BTreeMap::new();
    for (column, tag) in [
        ("event", "Event"),
        ("site", "Site"),
        ("date", "Date"),
        ("time", "UTCTime"),
        ("round", "Round"),
        ("white", "White"),
        ("black", "Black"),
        ("white_elo", "WhiteElo"),
        ("black_elo", "BlackElo"),
        ("result", "Result"),
        ("time_control", "TimeControl"),
    ] {
        if let Some(value) = row.get::<_, Option<String>>(column).map_err(sqlite_error)? {
            tags.insert(tag.into(), value);
        }
    }
    let fen = row
        .get::<_, Option<String>>("fen")
        .map_err(sqlite_error)?
        .filter(|fen| !fen.is_empty());
    let initial = match fen.as_deref() {
        Some(value) => value
            .parse::<shakmaty::fen::Fen>()
            .map_err(|error| invalid(error.to_string()))?,
        None => shakmaty::fen::Fen::default(),
    };
    // Validate before passing the FEN to either decoder or PGN parser.
    if let Some(fen) = fen {
        pgn::chess_from_fen(&fen).map_err(invalid)?;
        tags.insert("SetUp".into(), "1".into());
        tags.insert("FEN".into(), fen);
    }
    let bytes: Vec<u8> = row.get("moves").map_err(sqlite_error)?;
    let moves = legacy_encoding::decode_game_to_movetext(&bytes, initial)?;
    let result = tags.get("Result").cloned().unwrap_or_else(|| "*".into());
    Ok(format!(
        "{}\n{moves} {result}\n",
        annotations::write_tags(&tags)
    ))
}

fn convert(
    source: &Sqlite,
    destination: &Connection,
    mut progress: impl FnMut(u32),
) -> Result<u32, Error> {
    destination.execute_batch(include_str!("init-database.sql"))?;
    destination.execute_batch("CREATE TABLE db_info (name VARCHAR PRIMARY KEY, value VARCHAR);")?;
    for (old, new) in [("Title", "title"), ("Description", "description")] {
        destination.execute(
            "INSERT INTO db_info VALUES (?, ?)",
            params![new, info(source, old)?.unwrap_or_default()],
        )?;
    }
    let mut statement = source
        .prepare(
            "SELECT g.ID AS id, e.Name AS event, s.Name AS site,
            g.Date AS date, g.UTCTime AS time, CAST(g.Round AS TEXT) AS round,
            w.Name AS white, b.Name AS black,
            CAST(g.WhiteElo AS TEXT) AS white_elo, CAST(g.BlackElo AS TEXT) AS black_elo,
            CAST(g.Result AS TEXT) AS result, g.TimeControl AS time_control,
            g.FEN AS fen, g.Moves AS moves
         FROM Games g LEFT JOIN Events e ON e.ID = g.EventID
         LEFT JOIN Sites s ON s.ID = g.SiteID
         LEFT JOIN Players w ON w.ID = g.WhiteID
         LEFT JOIN Players b ON b.ID = g.BlackID ORDER BY g.ID",
        )
        .map_err(sqlite_error)?;
    let mut rows = statement.query([]).map_err(sqlite_error)?;
    let mut appender = super::game_appender(destination)?;
    let mut count = 0;
    while let Some(row) = rows.next().map_err(sqlite_error)? {
        let id: i64 = row.get("id").map_err(sqlite_error)?;
        let game = game_pgn(row)
            .and_then(|text| pgn::parse_single_game(&text).map_err(invalid))
            .map_err(|error| invalid(format!("Cannot convert game {id}: {error}")))?;
        appender.append_row(appender_params_from_iter(game.database_values()))?;
        count += 1;
        if count % 10_000 == 0 {
            progress(count);
        }
    }
    appender.flush()?;
    drop(appender);
    destination.execute_batch("CHECKPOINT")?;
    progress(count);
    Ok(count)
}

#[tauri::command]
#[specta::specta]
pub async fn convert_legacy_database(
    file: PathBuf,
    dest_file: PathBuf,
    app: tauri::AppHandle,
) -> Result<(), Error> {
    let start = Instant::now();
    convert_file(&file, &dest_file, |count| {
        let _ = app.emit(
            "convert_progress",
            (
                count,
                start.elapsed().as_millis() as u32,
                Option::<String>::None,
            ),
        );
    })
}

fn convert_file(file: &Path, dest_file: &Path, progress: impl FnMut(u32)) -> Result<(), Error> {
    if !is_sqlite(file)? {
        return Err(invalid("This is not a legacy SQLite database"));
    }
    if dest_file.exists() {
        return Err(invalid(
            "The destination already exists. Choose a new file.",
        ));
    }
    if dest_file.extension().and_then(|ext| ext.to_str()) != Some("duckdb") {
        return Err(invalid("The destination must have a .duckdb extension"));
    }
    // Publish only a complete database, and never overwrite an existing file.
    let directory = tempfile::tempdir_in(dest_file.parent().unwrap_or(Path::new(".")))?;
    let temporary = directory.path().join("converted.duckdb");
    let source = open(file)?;
    source.execute_batch("BEGIN").map_err(sqlite_error)?;
    let destination = Connection::open(&temporary)?;
    convert(&source, &destination, progress)?;
    drop(destination);
    tempfile::TempPath::from_path(temporary)
        .persist_noclobber(dest_file)
        .map_err(|error| Error::from(error.error))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> Sqlite {
        let db = Sqlite::open_in_memory().unwrap();
        db.execute_batch(
            "CREATE TABLE Info (Name TEXT, Value TEXT);
             INSERT INTO Info VALUES ('Title', 'A \"quoted\" title'), ('Description', 'Old games');
             CREATE TABLE Players (ID INTEGER, Name TEXT);
             INSERT INTO Players VALUES (1, 'White'), (2, 'Black');
             CREATE TABLE Events (ID INTEGER, Name TEXT);
             INSERT INTO Events VALUES (1, 'Test');
             CREATE TABLE Sites (ID INTEGER, Name TEXT);
             INSERT INTO Sites VALUES (1, 'Lisboa');
             CREATE TABLE Games (ID INTEGER, EventID INTEGER, SiteID INTEGER, Date TEXT,
                UTCTime TEXT, Round INTEGER, WhiteID INTEGER, BlackID INTEGER, WhiteElo INTEGER,
                BlackElo INTEGER, Result TEXT, TimeControl TEXT, ECO TEXT, FEN TEXT, Moves BLOB);",
        )
        .unwrap();
        db
    }

    fn add_game(db: &Sqlite, bytes: &[u8], fen: Option<&str>) {
        db.execute(
            "INSERT INTO Games VALUES (42, 1, 1, '2020.??.??', '12:34:56', 3, 1, 2,
                2400, 2300, '1-0', '300+3', 'C20', ?, ?)",
            rusqlite::params![fen, bytes],
        )
        .unwrap();
    }

    #[test]
    fn file_conversion_preserves_source_and_never_publishes_failed_imports() {
        let directory = tempfile::tempdir().unwrap();
        let source_path = directory.path().join("old.db3");
        let dest_path = directory.path().join("new.duckdb");
        let source = fixture();
        add_game(&source, &[12, 12], None);
        source
            .execute("VACUUM INTO ?", [source_path.to_str().unwrap()])
            .unwrap();
        let before = std::fs::read(&source_path).unwrap();
        convert_file(&source_path, &dest_path, |_| {}).unwrap();
        assert_eq!(std::fs::read(&source_path).unwrap(), before);
        let converted = std::fs::read(&dest_path).unwrap();
        assert!(convert_file(&source_path, &dest_path, |_| {}).is_err());
        assert_eq!(std::fs::read(&dest_path).unwrap(), converted);
        let db = Connection::open(&dest_path).unwrap();
        assert_eq!(
            db.query_row("SELECT COUNT(*) FROM games", [], |row| row.get::<_, i32>(0))
                .unwrap(),
            1
        );
        drop(db);

        let broken_path = directory.path().join("broken.db3");
        let broken_dest = directory.path().join("broken.duckdb");
        source
            .execute("UPDATE Games SET Moves = ?", [vec![253, 10, 0]])
            .unwrap();
        source
            .execute("VACUUM INTO ?", [broken_path.to_str().unwrap()])
            .unwrap();
        assert!(convert_file(&broken_path, &broken_dest, |_| {}).is_err());
        assert!(!broken_dest.exists());
        assert_eq!(std::fs::read_dir(directory.path()).unwrap().count(), 3);
    }

    #[test]
    fn conversion_preserves_headers_annotations_and_variations() {
        let source = fixture();
        // e4! {hello} (d4) e5, using the released move ordering.
        let mut bytes = vec![12];
        legacy_encoding::encode_nag("$1", &mut bytes);
        legacy_encoding::encode_comment("hello", &mut bytes);
        bytes.extend([255, 11, 254, 12]);
        add_game(&source, &bytes, None);
        let destination = Connection::open_in_memory().unwrap();
        let mut progress = Vec::new();
        assert_eq!(
            convert(&source, &destination, |count| progress.push(count)).unwrap(),
            1
        );
        assert_eq!(progress, [1]);
        let (data, annotations): (Vec<u8>, Vec<u8>) = destination
            .query_row("SELECT movedata, annotations FROM games", [], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .unwrap();
        let bare = super::super::annotations::decode_movetext(&data, None).unwrap();
        let movetext =
            super::super::annotations::restore_movetext(&bare, Some(&annotations)).unwrap();
        assert!(movetext.contains("hello"));
        assert!(movetext.contains("$1"));
        assert!(movetext.contains("d4"));
        assert!(movetext.contains("e5"));
        let (timestamp, round, rating): (String, String, i16) = destination
            .query_row(
                "SELECT strftime(utc_timestamp, '%Y.%m.%d %H:%M:%S'), round, white_rating FROM games",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(timestamp, "2020.01.01 12:34:56");
        assert_eq!(round, "3");
        assert_eq!(rating, 2400);
        let title: String = destination
            .query_row(
                "SELECT value FROM db_info WHERE name = 'title'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(title, "A \"quoted\" title");
        assert_eq!(
            info(&source, "Description").unwrap().as_deref(),
            Some("Old games")
        );
    }

    #[test]
    fn conversion_handles_nonstandard_start_and_empty_databases() {
        let source = fixture();
        let destination = Connection::open_in_memory().unwrap();
        assert_eq!(convert(&source, &destination, |_| {}).unwrap(), 0);
        let fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1";
        add_game(&source, &[12], Some(fen));
        let destination = Connection::open_in_memory().unwrap();
        convert(&source, &destination, |_| {}).unwrap();
        let (data, stored_fen): (Vec<u8>, String) = destination
            .query_row("SELECT movedata, fen FROM games", [], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .unwrap();
        assert_eq!(stored_fen, fen);
        assert!(super::super::annotations::decode_movetext(&data, Some(fen))
            .unwrap()
            .contains("e5"));
    }

    #[test]
    fn corrupt_games_fail_with_the_source_id() {
        let source = fixture();
        add_game(&source, &[253, 20, 0], None);
        let destination = Connection::open_in_memory().unwrap();
        let error = convert(&source, &destination, |_| {})
            .unwrap_err()
            .to_string();
        assert!(error.contains("game 42"));
        assert!(error.contains("Truncated"));
        assert_eq!(
            source
                .query_row("SELECT COUNT(*) FROM Games", [], |row| row.get::<_, i32>(0))
                .unwrap(),
            1
        );
    }

    #[test]
    fn detects_legacy_content_and_reads_metadata_without_writing() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("old.db3");
        let db = fixture();
        db.execute("VACUUM INTO ?", [path.to_str().unwrap()])
            .unwrap();
        let before = std::fs::read(&path).unwrap();
        assert!(is_sqlite(&path).unwrap());
        let info = database_info(&path).unwrap();
        assert!(info.needs_conversion);
        assert_eq!(info.game_count, 0);
        assert_eq!(info.title, "A \"quoted\" title");
        assert_eq!(std::fs::read(&path).unwrap(), before);
        assert!(is_sqlite(&directory.path().join("missing.db3")).is_err());
    }
}
