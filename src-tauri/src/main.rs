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
mod oauth;
mod opening;
mod pgn;
mod puzzle;

use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::{fs::create_dir_all, path::Path};

use chess::{BestMovesPayload, EngineProcess};
use dashmap::DashMap;
use db::{NormalizedGame, PositionQuery, PositionStats};
use derivative::Derivative;
use fide::FidePlayer;
use log::LevelFilter;
use oauth::AuthState;
use sysinfo::SystemExt;
use tauri::{
    api::path::{resolve_path, BaseDirectory},
    Manager, Window,
};
use tauri_plugin_log::LogTarget;

use crate::chess::{
    analyze_game, get_engine_logs, get_engine_name, get_pieces_count, get_single_best_move,
    kill_engines, make_move, similar_structure, stop_engine,
};
use crate::db::{
    clear_games, convert_pgn, create_indexes, delete_database, delete_indexes,
    get_players_game_info, get_tournaments, search_position,
};
use crate::fide::{download_fide_db, find_fide_player};
use crate::fs::{append_to_file, set_file_as_executable};
use crate::lexer::lex_pgn;
use crate::oauth::authenticate;
use crate::pgn::{count_pgn_games, delete_game, read_games, write_game};
use crate::puzzle::{get_puzzle, get_puzzle_db_info};
use crate::{
    chess::get_best_moves,
    db::{edit_db_info, get_db_info, get_games, get_players},
    fs::download_file,
    opening::{get_opening_from_fen, search_opening_name},
};
use tokio::sync::{RwLock, Semaphore};

pub type GameData = (i32, Option<String>, Vec<u8>, i32, i32, i32);

#[derive(Derivative)]
#[derivative(Default)]
pub struct AppState {
    connection_pool: DashMap<
        String,
        diesel::r2d2::Pool<diesel::r2d2::ConnectionManager<diesel::SqliteConnection>>,
    >,
    line_cache: DashMap<(PositionQuery, PathBuf), (Vec<PositionStats>, Vec<NormalizedGame>)>,
    db_cache: Mutex<Vec<GameData>>,
    #[derivative(Default(value = "Arc::new(Semaphore::new(2))"))]
    new_request: Arc<Semaphore>,
    pgn_offsets: DashMap<String, Vec<u64>>,
    fide_players: RwLock<Vec<FidePlayer>>,
    engine_processes: DashMap<(String, String), Arc<tokio::sync::Mutex<EngineProcess>>>,
    auth: AuthState,
}

const REQUIRED_DIRS: &[(BaseDirectory, &str)] = &[
    (BaseDirectory::AppData, "engines"),
    (BaseDirectory::AppData, "db"),
    (BaseDirectory::AppData, "presets"),
    (BaseDirectory::AppData, "puzzles"),
    (BaseDirectory::Document, "EnCroissant"),
];

const REQUIRED_FILES: &[(BaseDirectory, &str)] =
    &[(BaseDirectory::AppData, "engines/engines.json")];

#[tauri::command]
#[specta::specta]
fn close_splashscreen(window: Window) {
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
    let specta_builder = {
        let specta_builder = tauri_specta::ts::builder()
            .commands(tauri_specta::collect_commands!(
                close_splashscreen,
                find_fide_player,
                get_best_moves,
                get_single_best_move,
                analyze_game,
                stop_engine,
                kill_engines,
                get_engine_logs,
                memory_size,
                get_puzzle
            ))
            .events(tauri_specta::collect_events!(BestMovesPayload));

        #[cfg(debug_assertions)]
        let specta_builder = specta_builder.path("../src/bindings.ts");
        specta_builder.into_plugin()
    };

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .targets(LOG_TARGETS)
                .level(LevelFilter::Info)
                .build(),
        )
        .plugin(specta_builder)
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
            download_file,
            get_opening_from_fen,
            search_opening_name,
            get_games,
            get_players,
            get_tournaments,
            get_db_info,
            get_puzzle_db_info,
            edit_db_info,
            get_players_game_info,
            authenticate,
            delete_database,
            convert_pgn,
            search_position,
            is_bmi2_compatible,
            clear_games,
            get_engine_name,
            make_move,
            get_pieces_count,
            set_file_as_executable,
            count_pgn_games,
            read_games,
            append_to_file,
            delete_game,
            write_game,
            delete_indexes,
            create_indexes,
            lex_pgn,
            download_fide_db,
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

#[tauri::command]
#[specta::specta]
fn memory_size() -> u32 {
    let total_bytes = sysinfo::System::new_all().total_memory();
    return (total_bytes / 1024 / 1024) as u32;
}
