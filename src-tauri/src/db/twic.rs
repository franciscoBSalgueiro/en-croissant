//! Import [The Week in Chess](https://theweekinchess.com/) cumulative PGN zips into a database.

use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::time::Instant;

use chrono::Utc;
use log::info;
use reqwest::Client;
use tempfile::TempDir;
use diesel::connection::SimpleConnection;
use tauri::{AppHandle, Emitter, State};
use zip::ZipArchive;

use crate::db::{
    date_norm,
    generate_search_index,
    get_db_or_create,
    import_pgn_files_batch,
    query_max_game_date,
    update_info_counts,
    upsert_info_value,
    ConnectionOptions, JournalMode, CREATE_TABLES_SQL, DATABASE_VERSION, INDEXES_SQL,
};
use crate::db::schema::info;
use crate::AppState;
use crate::error::Error;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use diesel::OptionalExtension;

const TWIC_FIRST_ISSUE: u32 = 920;
const TWIC_ZIP_URL: &str = "https://theweekinchess.com/zips/twic{}g.zip";
const TWIC_TITLE: &str = "TWIC";
const TWIC_DESCRIPTION: &str = "The Week in Chess (theweekinchess.com)";
const INFO_LAST_ISSUE: &str = "TwicLastIssue";
const INFO_MAX_DATE: &str = "TwicMaxGameDate";

fn twic_zip_url(issue: u32) -> String {
    TWIC_ZIP_URL.replace("{}", &issue.to_string())
}

fn collect_pgn_files(dir: &Path) -> std::io::Result<Vec<PathBuf>> {
    let mut out = Vec::new();
    fn walk(dir: &Path, out: &mut Vec<PathBuf>) -> std::io::Result<()> {
        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            let p = entry.path();
            if p.is_dir() {
                walk(&p, out)?;
            } else if p
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.eq_ignore_ascii_case("pgn"))
                .unwrap_or(false)
            {
                out.push(p);
            }
        }
        Ok(())
    }
    walk(dir, &mut out)?;
    Ok(out)
}

fn extract_zip_to_dir(bytes: &[u8], dest: &Path) -> Result<(), Error> {
    let mut archive = ZipArchive::new(Cursor::new(bytes))?;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let outpath = dest.join(file.mangled_name());
        if (*file.name()).ends_with('/') {
            std::fs::create_dir_all(&outpath)?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    std::fs::create_dir_all(p)?;
                }
            }
            let mut outfile = std::fs::File::create(&outpath)?;
            std::io::copy(&mut file, &mut outfile)?;
        }
    }
    Ok(())
}

fn max_date_within_last_week(date_str: &str) -> bool {
    let Some(d) = date_norm::parse_game_date_chronological(date_str) else {
        return false;
    };
    let today = Utc::now().date_naive();
    (today - d).num_days() <= 7
}

fn read_info_i32(db: &mut SqliteConnection, key: &str) -> Result<Option<i32>, Error> {
    let row: Option<Option<String>> = info::table
        .filter(info::name.eq(key))
        .select(info::value)
        .first(db)
        .optional()?;
    Ok(row.flatten().and_then(|s| s.parse().ok()))
}

/// `mode`: `"initial"` starts at issue 920 until data is within the last week or a zip is missing.
/// `"update"` continues from the last stored issue + 1 until a zip is missing.
#[tauri::command]
#[specta::specta]
pub async fn sync_twic_database(
    db_path: PathBuf,
    mode: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let initial = mode == "initial";

    let client = Client::new();
    let db_exists = db_path.exists();

    let db = &mut get_db_or_create(
        &state,
        db_path.to_str().unwrap(),
        ConnectionOptions {
            enable_foreign_keys: false,
            busy_timeout: None,
            journal_mode: JournalMode::Off,
        },
    )?;

    if !db_exists {
        db.batch_execute(CREATE_TABLES_SQL)?;
        db.batch_execute(
            format!(
                "INSERT INTO Info (Name, Value) VALUES (\"Version\", \"{DATABASE_VERSION}\");
                INSERT INTO Info (Name, Value) VALUES (\"Title\", \"{TWIC_TITLE}\");
                INSERT INTO Info (Name, Value) VALUES (\"Description\", \"{TWIC_DESCRIPTION}\");"
            )
            .as_str(),
        )?;
    }

    let mut issue: u32 = if initial {
        TWIC_FIRST_ISSUE
    } else {
        let last = read_info_i32(db, INFO_LAST_ISSUE)?.ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "No TWIC issue index stored; run the initial TWIC install first.",
            )
        })?;
        (last as u32).saturating_add(1)
    };

    let start = Instant::now();
    let mut total_imported = 0usize;
    let mut indexes_created = db_exists;

    loop {
        let url = twic_zip_url(issue);
        info!("TWIC: fetching {}", url);

        let response = client.get(&url).send().await?;
        if !response.status().is_success() {
            info!(
                "TWIC: HTTP {} for issue {} — stopping",
                response.status(),
                issue
            );
            break;
        }

        let bytes = response.bytes().await?;
        let temp = TempDir::new()?;
        let extract_root = temp.path();
        extract_zip_to_dir(&bytes, extract_root)?;

        let pgns = collect_pgn_files(extract_root).map_err(Error::from)?;
        if pgns.is_empty() {
            info!("TWIC: no PGN in issue {} — stopping", issue);
            break;
        }

        let label = format!("TWIC #{issue}");
        total_imported = import_pgn_files_batch(
            db,
            &pgns,
            None,
            &app,
            start,
            total_imported,
        )?;

        if !indexes_created {
            db.batch_execute(INDEXES_SQL)?;
            indexes_created = true;
        }

        update_info_counts(db)?;
        upsert_info_value(db, INFO_LAST_ISSUE, &issue.to_string())?;

        let max_date = query_max_game_date(db)?;
        if let Some(ref d) = max_date {
            upsert_info_value(db, INFO_MAX_DATE, d)?;
        }

        let _ = app.emit(
            "convert_progress",
            (total_imported, start.elapsed().as_millis() as u32, Some(label)),
        );

        if initial {
            if let Some(ref d) = max_date {
                if max_date_within_last_week(d) {
                    info!("TWIC: max game date {d} is within the last 7 days — initial sync done");
                    break;
                }
            }
        }

        issue = issue.saturating_add(1);

        // Safety: avoid infinite loop if site misbehaves
        if issue > TWIC_FIRST_ISSUE + 10_000 {
            break;
        }
    }

    if total_imported > 0 {
        generate_search_index(db_path.as_path(), &state)?;
    }

    Ok(())
}
