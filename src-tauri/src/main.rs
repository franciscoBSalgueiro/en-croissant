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

use chess::{BestMovesPayload, EngineProcess, ReportProgress};
use dashmap::DashMap;
use db::{DatabaseProgress, NormalizedGame, PositionQuery, PositionStats};
use derivative::Derivative;
use fide::FidePlayer;
use log::LevelFilter;
use oauth::AuthState;
use specta::ts::{BigIntExportBehavior, ExportConfig};
use sysinfo::SystemExt;
use tauri::{
    api::path::{resolve_path, BaseDirectory},
    Manager, Window,
};
use tauri::{CustomMenuItem, Menu, MenuItem, Submenu};
use tauri_plugin_log::LogTarget;

use crate::chess::{analyze_game, get_engine_config, get_engine_logs, kill_engines, stop_engine};
use crate::db::{
    clear_games, convert_pgn, create_indexes, delete_database, delete_db_game, delete_empty_games,
    delete_indexes, get_players_game_info, get_tournaments, search_position,
};
use crate::fide::{download_fide_db, find_fide_player};
use crate::fs::{append_to_file, set_file_as_executable, DownloadProgress};
use crate::lexer::lex_pgn;
use crate::oauth::authenticate;
use crate::pgn::{count_pgn_games, delete_game, read_games, write_game};
use crate::puzzle::{get_puzzle, get_puzzle_db_info};
use crate::{
    chess::get_best_moves,
    db::{
        delete_duplicated_games, edit_db_info, get_db_info, get_games, get_players, merge_players,
    },
    fs::{download_file, file_exists, get_file_metadata},
    opening::{get_opening_from_fen, get_opening_from_name, search_opening_name},
};
use tokio::sync::{RwLock, Semaphore};
use window_shadows::set_shadow;

pub type GameData = (i32, Option<String>, Vec<u8>, Option<String>, i32, i32, i32);

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

const REQUIRED_FILES: &[(BaseDirectory, &str, &str)] =
    &[(BaseDirectory::AppData, "engines/engines.json", "[]")];

#[tauri::command]
#[specta::specta]
async fn close_splashscreen(window: Window) -> Result<(), String> {
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
    Ok(())
}

#[cfg(debug_assertions)]
const LOG_TARGETS: [LogTarget; 2] = [LogTarget::Stdout, LogTarget::Webview];

#[cfg(not(debug_assertions))]
const LOG_TARGETS: [LogTarget; 2] = [LogTarget::Stdout, LogTarget::LogDir];

fn main() {
    let specta_builder = {
        let specta_builder = tauri_specta::ts::builder()
            .config(ExportConfig::new().bigint(BigIntExportBehavior::BigInt))
            .commands(tauri_specta::collect_commands!(
                close_splashscreen,
                find_fide_player,
                get_best_moves,
                analyze_game,
                stop_engine,
                kill_engines,
                get_engine_logs,
                memory_size,
                get_puzzle,
                set_menu_visisble,
                is_menu_visisble,
                get_opening_from_fen,
                get_opening_from_name,
                get_players_game_info,
                get_engine_config,
                file_exists,
                get_file_metadata,
                merge_players
            ))
            .events(tauri_specta::collect_events!(
                BestMovesPayload,
                DatabaseProgress,
                DownloadProgress,
                ReportProgress
            ));

        #[cfg(debug_assertions)]
        let specta_builder = specta_builder.path("../src/bindings.ts");
        specta_builder.into_plugin()
    };

    let menu = Menu::new()
        .add_submenu(Submenu::new(
            "File",
            Menu::new()
                .add_item(CustomMenuItem::new("new_tab".to_string(), "New tab"))
                .add_item(CustomMenuItem::new("open_file".to_string(), "Open file"))
                .add_native_item(MenuItem::Quit),
        ))
        .add_submenu(Submenu::new(
            "Edit",
            Menu::new()
                .add_native_item(MenuItem::Undo)
                .add_native_item(MenuItem::Redo)
                .add_native_item(MenuItem::Separator)
                .add_native_item(MenuItem::Cut)
                .add_native_item(MenuItem::Copy)
                .add_native_item(MenuItem::Paste)
                .add_native_item(MenuItem::SelectAll),
        ))
        .add_submenu(Submenu::new(
            "View",
            Menu::new()
                .add_item(CustomMenuItem::new("reload".to_string(), "Reload"))
                .add_native_item(MenuItem::EnterFullScreen)
                .add_native_item(MenuItem::Minimize),
        ))
        .add_submenu(Submenu::new(
            "Help",
            Menu::new()
                .add_item(CustomMenuItem::new(
                    "clear_saved_data".to_string(),
                    "Clear saved data",
                ))
                .add_item(CustomMenuItem::new("open_logs".to_string(), "Open logs"))
                .add_item(CustomMenuItem::new(
                    "check_for_updates".to_string(),
                    "Check for updates",
                ))
                .add_item(CustomMenuItem::new("about".to_string(), "About")),
        ));

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
            log::info!("Setting up application");

            log::info!("Checking for required directories");
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
                        log::info!("Creating directory {}", path.to_string_lossy());
                        create_dir_all(&path).unwrap();
                    }
                };
            }

            log::info!("Checking for required files");
            for (dir, path, contents) in REQUIRED_FILES.iter() {
                let path = resolve_path(
                    &app.config(),
                    app.package_info(),
                    &app.env(),
                    path,
                    Some(*dir),
                )
                .unwrap();
                if !Path::new(&path).exists() {
                    log::info!("Creating file {}", path.to_string_lossy());
                    std::fs::write(&path, contents).unwrap();
                }
            }

            #[cfg(any(windows, target_os = "macos"))]
            set_shadow(&app.get_window("main").unwrap(), true).unwrap();

            Ok(())
        })
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            download_file,
            get_games,
            get_players,
            get_tournaments,
            get_db_info,
            get_puzzle_db_info,
            edit_db_info,
            delete_duplicated_games,
            authenticate,
            delete_database,
            convert_pgn,
            search_position,
            is_bmi2_compatible,
            clear_games,
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
            search_opening_name,
            delete_db_game,
            delete_empty_games,
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
