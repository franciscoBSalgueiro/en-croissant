#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod chess;
mod db;
mod fs;
mod opening;
mod puzzle;

use std::sync::Mutex;
use std::{collections::HashMap, fs::create_dir_all, path::Path};

use reqwest::Url;
use tauri::{
    api::path::{resolve_path, BaseDirectory},
    Manager, Window,
};

use crate::chess::analyze_game;
use crate::puzzle::get_puzzle;
use crate::{
    chess::get_best_moves,
    db::{get_db_info, get_games, get_players, rename_db},
    fs::{download_file, file_exists},
    opening::get_opening,
};

use tauri_plugin_oauth::start;

#[tauri::command]
async fn start_server(verifier: String, window: Window) -> Result<u16, String> {
    println!("Starting server");

    start(None, move |url| {
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
                    "client_id": "FrankWillow",
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
            println!("Sent redirect_uri event");
        } else {
            println!("Failed to send redirect_uri event");
        }
    })
    .map_err(|err| err.to_string())
}

#[derive(Default)]
pub struct AppState(
    Mutex<
        HashMap<
            String,
            diesel::r2d2::Pool<diesel::r2d2::ConnectionManager<diesel::SqliteConnection>>,
        >,
    >,
);

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
        .manage(AppState(Default::default()))
        .invoke_handler(tauri::generate_handler![
            download_file,
            file_exists,
            get_best_moves,
            get_opening,
            get_puzzle,
            get_games,
            get_players,
            get_db_info,
            rename_db,
            // get_players_game_info,
            start_server,
            analyze_game,
            // search_opening
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
