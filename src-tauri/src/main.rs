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
use tauri::{CustomMenuItem, Menu, MenuItem, Submenu};
use tauri_plugin_log::LogTarget;

use crate::chess::{
    analyze_game, get_engine_logs, get_engine_name, get_single_best_move, kill_engines, stop_engine,
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
    (BaseDirectory::AppData, "documents"),
    (BaseDirectory::Document, "EnCroissant"),
];

const REQUIRED_FILES: &[(BaseDirectory, &str)] =
    &[(BaseDirectory::AppData, "engines/engines.json")];

#[tauri::command]
#[specta::specta]
fn close_splashscreen(window: Window) {
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
                get_puzzle,
                set_menu_visisble,
                is_menu_visisble,
                get_opening_from_fen
            ))
            .events(tauri_specta::collect_events!(BestMovesPayload));

        #[cfg(debug_assertions)]
        let specta_builder = specta_builder.path("../src/bindings.ts");
        specta_builder.into_plugin()
    };

    let new_tab = CustomMenuItem::new("new_tab".to_string(), "New tab");
    let open_file = CustomMenuItem::new("open_file".to_string(), "Open file");
    let file_menu = Submenu::new(
        "File",
        Menu::new()
            .add_item(new_tab)
            .add_item(open_file)
            .add_native_item(MenuItem::Quit),
    );

    let reload = CustomMenuItem::new("reload".to_string(), "Reload");

    let view_menu = Submenu::new("View", Menu::new().add_item(reload));

    let clear_saved_data = CustomMenuItem::new("clear_saved_data".to_string(), "Clear saved data");
    let check_updates = CustomMenuItem::new("check_updates".to_string(), "Check for updates");
    let about = CustomMenuItem::new("about".to_string(), "About");
    let help_menu = Submenu::new(
        "Help",
        Menu::new()
            .add_item(clear_saved_data)
            .add_item(check_updates)
            .add_item(about),
    );

    let menu = Menu::new()
        .add_submenu(file_menu)
        .add_submenu(view_menu)
        .add_submenu(help_menu);

    tauri::Builder::default()
        .menu(menu)
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
                );
                if let Ok(path) = path {
                    if !Path::new(&path).exists() {
                        create_dir_all(&path).unwrap();
                    }
                };
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
async fn is_menu_visisble(window: tauri::Window) -> bool {
    window.menu_handle().is_visible().unwrap()
}

#[tauri::command]
#[specta::specta]
async fn set_menu_visisble(state: bool, window: tauri::Window) {
    let menu = window.menu_handle();
    if state {
        menu.show().unwrap();
        window.set_decorations(true).unwrap();
    } else {
        menu.hide().unwrap();
        window.set_decorations(false).unwrap();
    }
}

#[tauri::command]
#[specta::specta]
fn memory_size() -> u32 {
    let total_bytes = sysinfo::System::new_all().total_memory();
    (total_bytes / 1024 / 1024) as u32
}
