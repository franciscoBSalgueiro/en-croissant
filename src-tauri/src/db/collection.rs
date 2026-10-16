use super::*;

fn ids_clause(ids: &[i32]) -> String {
    if ids.is_empty() {
        return "FALSE".into();
    }
    format!(
        "rowid IN ({})",
        ids.iter().map(i32::to_string).collect::<Vec<_>>().join(",")
    )
}

#[tauri::command]
#[specta::specta]
pub async fn collection_ids(
    file: PathBuf,
    query: GameQuery,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<i32>, Error> {
    let pool = get_duckdb_pool(&state, &file)?;
    let db = pool.get()?;
    matching_ids(&db, &query)
}

fn matching_ids(db: &Connection, query: &GameQuery) -> Result<Vec<i32>, Error> {
    let clauses = build_game_where_clauses(query);
    let filter = if clauses.is_empty() {
        "TRUE".into()
    } else {
        clauses.join(" AND ")
    };
    let mut stmt = db.prepare(&format!(
        "SELECT CAST(rowid AS INTEGER) FROM games WHERE {filter} ORDER BY rowid"
    ))?;
    let ids = stmt
        .query_map([], |row| row.get(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(ids)
}

#[tauri::command]
#[specta::specta]
pub async fn delete_collection(
    file: PathBuf,
    ids: Vec<i32>,
    state: tauri::State<'_, AppState>,
) -> Result<usize, Error> {
    let pool = get_duckdb_pool(&state, &file)?;
    let mut db = pool.get()?;
    let changed = delete_ids(&mut db, &ids)?;
    let _invalidate = DatabaseCacheInvalidation::new(&state, &file);
    Ok(changed)
}

fn delete_ids(db: &mut Connection, ids: &[i32]) -> Result<usize, Error> {
    let tx = db.transaction()?;
    let changed = tx.execute(&format!("DELETE FROM games WHERE {}", ids_clause(ids)), [])?;
    // Fail atomically if the confirmed collection changed before execution.
    if changed != ids.iter().collect::<std::collections::HashSet<_>>().len() {
        return Err(std::io::Error::other(
            "The collection changed. Refresh and confirm deletion again.",
        )
        .into());
    }
    tx.commit()?;
    Ok(changed)
}

#[tauri::command]
#[specta::specta]
pub async fn export_collection(
    file: PathBuf,
    ids: Vec<i32>,
    destination: PathBuf,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    if destination == file || destination.canonicalize().ok() == file.canonicalize().ok() {
        return Err(std::io::Error::other("Choose a different output file.").into());
    }
    let pool = get_duckdb_pool(&state, &file)?;
    let db = pool.get()?;
    if !destination
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("pgn"))
    {
        return Err(std::io::Error::other("The export destination must be a .pgn file.").into());
    }
    let mut output =
        tempfile::NamedTempFile::new_in(destination.parent().unwrap_or(Path::new(".")))?;
    let mut writer = BufWriter::new(output.as_file_mut());
    write_pgn(&db, &ids, &mut writer)?;
    writer.flush()?;
    drop(writer);
    output.persist(destination).map_err(|err| err.error)?;
    Ok(())
}

fn write_pgn(db: &Connection, ids: &[i32], writer: &mut impl Write) -> Result<(), Error> {
    let mut stmt = db.prepare(&format!("SELECT CAST(rowid AS INTEGER) AS id, *, strftime(utc_timestamp, '%Y.%m.%d') AS date, strftime(utc_timestamp, '%H:%M:%S') AS time FROM games WHERE {} ORDER BY rowid", ids_clause(ids)))?;
    for game in stmt.query_map([], export_game)? {
        writer.write_all(game?.as_bytes())?;
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn copy_collection(
    file: PathBuf,
    ids: Vec<i32>,
    destination: PathBuf,
    create: bool,
    state: tauri::State<'_, AppState>,
) -> Result<usize, Error> {
    if create && destination.exists() {
        return Err(
            std::io::Error::other("The new database already exists. Choose another name.").into(),
        );
    }
    if !create && !destination.exists() {
        return Err(std::io::Error::other("The destination database no longer exists.").into());
    }
    let source_pool = get_duckdb_pool(&state, &file)?;
    let source = source_pool.get()?;
    if create {
        // Build privately and publish only after the transaction succeeds. The
        // temporary directory also cleans up failed databases and WAL files.
        let temporary = tempfile::tempdir_in(destination.parent().unwrap_or(Path::new(".")))?;
        let path = temporary.path().join("collection.duckdb");
        let count = {
            let mut target = Connection::open(&path)?;
            copy_ids(&source, &mut target, &ids, true)?
        };
        // create_new prevents replacing a file created since the dialog opened.
        let mut output = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&destination)?;
        if let Err(error) = std::io::copy(&mut File::open(path)?, &mut output) {
            drop(output);
            let _ = remove_file(&destination);
            return Err(error.into());
        }
        return Ok(count);
    }
    let target_pool = get_duckdb_pool(&state, &destination)?;
    let mut target = target_pool.get()?;
    let count = copy_ids(&source, &mut target, &ids, create)?;
    let _invalidate = DatabaseCacheInvalidation::new(&state, &destination);
    Ok(count)
}

fn copy_ids(
    source: &Connection,
    target: &mut Connection,
    ids: &[i32],
    create: bool,
) -> Result<usize, Error> {
    let mut stmt = source.prepare(&format!(
        "SELECT * FROM games WHERE {} ORDER BY rowid",
        ids_clause(ids)
    ))?;
    let rows = stmt.query_map([], |row| {
        (0..16)
            .map(|i| row.get::<_, duckdb::types::Value>(i))
            .collect::<duckdb::Result<Vec<_>>>()
    })?;
    let tx = target.transaction()?;
    if create {
        tx.execute_batch(include_str!("init-database.sql"))?;
    }
    let mut count = 0;
    {
        let mut appender = tx.appender("games")?;
        for row in rows {
            appender.append_row(duckdb::appender_params_from_iter(row?))?;
            count += 1;
        }
        appender.flush()?;
    }
    tx.commit()?;
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn database() -> Connection {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch(include_str!("init-database.sql")).unwrap();
        for name in ["First", "Second", "Third"] {
            db.execute(
                "INSERT INTO games (white, movedata, annotations) VALUES (?, ?, ?)",
                params![name, vec![1u8, 2, 3], vec![4u8, 5, 6]],
            )
            .unwrap();
        }
        db
    }

    #[test]
    fn deletion_is_exact_and_rolls_back_when_selection_is_stale() {
        let mut db = database();
        assert!(delete_ids(&mut db, &[0, 99]).is_err());
        assert_eq!(
            db.query_row("SELECT COUNT(*) FROM games", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            3
        );
        assert_eq!(delete_ids(&mut db, &[0, 2, 2]).unwrap(), 2);
        assert_eq!(delete_ids(&mut db, &[]).unwrap(), 0);
        assert_eq!(
            db.query_row("SELECT white FROM games", [], |r| r.get::<_, String>(0))
                .unwrap(),
            "Second"
        );
    }

    #[test]
    fn matching_ignores_pagination_but_preserves_filters() {
        let db = database();
        let mut query = GameQuery::default();
        query.options = Some(QueryOptions {
            page: Some(2),
            page_size: Some(1),
            ..Default::default()
        });
        assert_eq!(matching_ids(&db, &query).unwrap(), vec![0, 1, 2]);
        query.player1 = Some("Second".into());
        query.sides = Some(Sides::WhiteBlack);
        assert_eq!(matching_ids(&db, &query).unwrap(), vec![1]);
        query.player1 = Some("Nobody's name".into());
        assert!(matching_ids(&db, &query).unwrap().is_empty());
    }

    #[test]
    fn selected_export_round_trips_comments_and_variations() {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch(include_str!("init-database.sql")).unwrap();
        let input = "[White \"Selected\"]\n[Black \"Opponent\"]\n[Result \"*\"]\n\n{Root} 1. e4 {Comment} (1. d4 d5 (1... Nf6 {Nested})) e5 *";
        let original = pgn::parse_single_game(input).unwrap();
        let expected_annotations = original.annotations.clone();
        {
            let mut appender = db.appender("games").unwrap();
            appender
                .append_row(duckdb::appender_params_from_iter(
                    original.database_values(),
                ))
                .unwrap();
            appender.flush().unwrap();
        }
        db.execute("INSERT INTO games (white) VALUES ('Excluded')", [])
            .unwrap();
        let mut output = Vec::new();
        write_pgn(&db, &[0], &mut output).unwrap();
        let exported = String::from_utf8(output).unwrap();
        assert!(!exported.contains("Excluded"));
        assert!(exported.contains("{Comment}"));
        assert!(exported.contains("{Nested}"));
        assert_eq!(
            pgn::parse_single_game(&exported).unwrap().annotations,
            expected_annotations
        );
    }

    #[test]
    fn copying_preserves_raw_move_and_annotation_data_and_appends() {
        let source = database();
        let mut target = Connection::open_in_memory().unwrap();
        assert_eq!(copy_ids(&source, &mut target, &[0, 2], true).unwrap(), 2);
        assert_eq!(copy_ids(&source, &mut target, &[1], false).unwrap(), 1);
        assert_eq!(copy_ids(&source, &mut target, &[], false).unwrap(), 0);
        let mut stmt = target
            .prepare("SELECT movedata, annotations FROM games")
            .unwrap();
        let values = stmt
            .query_map([], |r| {
                Ok((r.get::<_, Vec<u8>>(0)?, r.get::<_, Vec<u8>>(1)?))
            })
            .unwrap();
        for value in values {
            assert_eq!(value.unwrap(), (vec![1, 2, 3], vec![4, 5, 6]));
        }
        assert_eq!(
            source
                .query_row("SELECT COUNT(*) FROM games", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            3
        );
    }
}
