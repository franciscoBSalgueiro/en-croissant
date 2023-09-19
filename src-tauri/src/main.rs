#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod chess;
mod db;
mod error;
mod fide;
mod fs;
mod lexer;
mod opening;
mod pgn;
mod puzzle;

use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::{fs::create_dir_all, path::Path};

use chess::{AnalysisCacheKey, BestMoves};
use dashmap::DashMap;
use db::{NormalizedGame, PositionQuery, PositionStats};
use derivative::Derivative;
use fide::FidePlayer;
use log::info;
use reqwest::Url;
use tauri::{
    api::path::{resolve_path, BaseDirectory},
    Manager, Window,
};
use tauri_plugin_log::LogTarget;

use crate::chess::{
    analyze_game, get_engine_name, get_single_best_move, make_move, make_random_move, put_piece,
    similar_structure, validate_fen,
};
use crate::db::{
    clear_games, convert_pgn, create_indexes, delete_database, delete_indexes,
    get_players_game_info, get_tournaments, search_position,
};
use crate::fide::find_fide_player;
use crate::fs::{append_to_file, set_file_as_executable};
use crate::lexer::lex_pgn;
use crate::pgn::{count_pgn_games, delete_game, read_games, write_game};
use crate::puzzle::{get_puzzle, get_puzzle_db_info};
use crate::{
    chess::get_best_moves,
    db::{edit_db_info, get_db_info, get_games, get_players},
    fs::download_file,
    opening::get_opening_from_fen,
};
use tokio::sync::{RwLock, Semaphore};

use specta::collect_types;
use tauri_specta::ts;

use crate::error::Error;
use tauri_plugin_oauth::start;

#[tauri::command]
async fn start_server(username: String, verifier: String, window: Window) -> Result<u16, Error> {
    info!("Starting server");

    Ok(start(move |url| {
        // Because of the unprotected localhost port, you must verify the URL here.
        // Preferebly send back only the token, or nothing at all if you can handle everything else in Rust.

        // convert the string to a url
        let url = Url::parse(&url).unwrap();
        let url_string = url.to_string();
        let base_url = url_string.split('?').collect::<Vec<&str>>()[0];

        // get the code query parameter
        let code = url
            .query_pairs()
            .find(|(k, _)| k == "code")
            .unwrap_or_default()
            .1;

        let client = reqwest::blocking::Client::new();

        let res = client
            .post("https://lichess.org/api/token")
            .header("Content-Type", "application/json")
            .body(
                serde_json::json!({
                    "grant_type": "authorization_code",
                    "redirect_uri": base_url,
                    "username": username,
                    "client_id": "org.encroissant.app",
                    "code": code,
                    "code_verifier": verifier
                })
                .to_string(),
            )
            .send()
            .unwrap();

        let json = res.json::<serde_json::Value>().unwrap();
        let token = json["access_token"].as_str().unwrap();

        if window.emit("redirect_uri", token).is_ok() {
            info!("Sent redirect_uri event");
        } else {
            info!("Failed to send redirect_uri event");
        }
    })?)
}

#[derive(Derivative)]
#[derivative(Default)]
pub struct AppState {
    connection_pool: DashMap<
        String,
        diesel::r2d2::Pool<diesel::r2d2::ConnectionManager<diesel::SqliteConnection>>,
    >,
    line_cache: DashMap<(PositionQuery, PathBuf), (Vec<PositionStats>, Vec<NormalizedGame>)>,
    db_cache: Mutex<Vec<(i32, Option<String>, Vec<u8>, i32, i32, i32)>>,
    analysis_cache: DashMap<AnalysisCacheKey, Vec<BestMoves>>,
    #[derivative(Default(value = "Arc::new(Semaphore::new(2))"))]
    new_request: Arc<Semaphore>,
    pgn_offsets: DashMap<String, Vec<u64>>,
    fide_players: RwLock<Vec<FidePlayer>>,
}

const REQUIRED_DIRS: &[(BaseDirectory, &str)] = &[
    (BaseDirectory::AppData, "engines"),
    (BaseDirectory::AppData, "db"),
    (BaseDirectory::AppData, "puzzles"),
    (BaseDirectory::Document, "EnCroissant"),
];

const REQUIRED_FILES: &[(BaseDirectory, &str)] =
    &[(BaseDirectory::AppData, "engines/engines.json")];

#[tauri::command]
async fn close_splashscreen(window: Window) {
    // Show main window
    window
        .get_window("main")
        .expect("no window labeled 'main' found")
        .maximize()
        .unwrap();
    window
        .get_window("main")
        .expect("no window labeled 'main' found")
        .show()
        .unwrap();
}

#[cfg(debug_assertions)]
const LOG_TARGETS: [LogTarget; 2] = [LogTarget::Stdout, LogTarget::Webview];

#[cfg(not(debug_assertions))]
const LOG_TARGETS: [LogTarget; 2] = [LogTarget::Stdout, LogTarget::LogDir];

fn main() {
    #[cfg(debug_assertions)]
    ts::export(collect_types![find_fide_player,], "../src/bindings.ts").unwrap();

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .targets(LOG_TARGETS)
                .build(),
        )
        .setup(|app| {
            // Check if all the required directories exist, and create them if they don't
            for (dir, path) in REQUIRED_DIRS.iter() {
                let path = resolve_path(
                    &app.config(),
                    app.package_info(),
                    &app.env(),
                    path,
                    Some(*dir),
                )
                .unwrap();
                if !Path::new(&path).exists() {
                    create_dir_all(&path).unwrap();
                }
            }

            for (dir, path) in REQUIRED_FILES.iter() {
                let path = resolve_path(
                    &app.config(),
                    app.package_info(),
                    &app.env(),
                    path,
                    Some(*dir),
                )
                .unwrap();
                if !Path::new(&path).exists() {
                    std::fs::write(&path, "").unwrap();
                }
            }

            Ok(())
        })
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            close_splashscreen,
            download_file,
            get_best_moves,
            get_opening_from_fen,
            get_puzzle,
            get_games,
            get_players,
            get_tournaments,
            get_db_info,
            get_puzzle_db_info,
            edit_db_info,
            get_players_game_info,
            start_server,
            analyze_game,
            delete_database,
            convert_pgn,
            search_position,
            get_single_best_move,
            is_bmi2_compatible,
            clear_games,
            get_engine_name,
            put_piece,
            make_move,
            make_random_move,
            set_file_as_executable,
            validate_fen,
            count_pgn_games,
            read_games,
            append_to_file,
            delete_game,
            write_game,
            delete_indexes,
            create_indexes,
            lex_pgn,
            find_fide_player,
            similar_structure
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn is_bmi2_compatible() -> bool {
    #[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
    if is_x86_feature_detected!("bmi2") {
        return true;
    }
    false
}
