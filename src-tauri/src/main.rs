#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod chess;
mod fs;
mod db;
mod opening;

use std::{fs::create_dir_all, path::Path};

use tauri::{
    api::path::{resolve_path, BaseDirectory},
    Manager,
};

use crate::{
    chess::get_best_moves,
    fs::{download_file, file_exists, list_folders, remove_folder}, db::read_pgn, opening::get_opening,
};

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Check if the directory exists, if not, create it
            let path = resolve_path(
                &app.config(),
                app.package_info(),
                &app.env(),
                "engines",
                Some(BaseDirectory::AppData),
            )
            .unwrap();
            if !Path::new(&path).exists() {
                create_dir_all(&path).unwrap();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            download_file,
            list_folders,
            file_exists,
            remove_folder,
            get_best_moves,
            read_pgn,
            get_opening
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
