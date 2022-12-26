#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod chess;
mod db;
mod fs;
mod opening;

use std::{fs::create_dir_all, path::Path};

use tauri::{
    api::path::{resolve_path, BaseDirectory},
    Manager,
};

use crate::{
    chess::get_best_moves,
    db::{convert_pgn, get_games, get_number_games, get_players},
    fs::{download_file, file_exists},
    opening::get_opening,
};

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Check if all the necessary directories exist, and create them if they don't

            let engines_path = resolve_path(
                &app.config(),
                app.package_info(),
                &app.env(),
                "engines",
                Some(BaseDirectory::AppData),
            )
            .unwrap();
            if !Path::new(&engines_path).exists() {
                create_dir_all(&engines_path).unwrap();
            }

            let db_path = resolve_path(
                &app.config(),
                app.package_info(),
                &app.env(),
                "db",
                Some(BaseDirectory::AppData),
            )
            .unwrap();
            if !Path::new(&db_path).exists() {
                create_dir_all(&db_path).unwrap();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            download_file,
            file_exists,
            get_best_moves,
            get_opening,
            convert_pgn,
            get_number_games,
            get_games,
            get_players
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
