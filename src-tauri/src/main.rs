#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use en_croissant::chess::BestMovesPayload;
use en_croissant::db::DatabaseProgress;
use en_croissant::game::{ClockUpdateEvent, GameMoveEvent, GameOverEvent};
use en_croissant::progress::ProgressEvent;
use en_croissant::sound;
use en_croissant::AppState;

use log::LevelFilter;
#[cfg(debug_assertions)]
use specta_typescript::{BigIntExportBehavior, Typescript};
use sysinfo::SystemExt;
use tauri::{Emitter, Manager, Window};
use tauri_plugin_log::{Target, TargetKind};

#[cfg_attr(feature = "tauri", tauri::command)]
#[cfg_attr(feature = "tauri", specta::specta)]
async fn close_splashscreen(window: Window) -> Result<(), String> {
    window
        .get_webview_window("main")
        .expect("no window labeled 'main' found")
        .show()
        .unwrap();
    Ok(())
}

pub fn file_from_args(args: &[String], cwd: &str) -> Option<String> {
    let mut args = args.iter().skip(1);
    let first = args.next()?;
    let file = if first == "--" {
        args.next()?
    } else if first.starts_with('-') {
        return None;
    } else {
        first
    };
    if args.next().is_some() || file.to_ascii_lowercase().starts_with("encroissant:") {
        return None;
    }
    Some(std::path::Path::new(cwd).join(file).to_string_lossy().into_owned())
}

fn main() {
    let specta_builder = tauri_specta::Builder::new()
        .commands(tauri_specta::collect_commands!(
            close_splashscreen,
            en_croissant::chess::get_best_moves,
            en_croissant::chess::analyze_game,
            en_croissant::chess::cancel_analysis,
            en_croissant::chess::stop_engine,
            en_croissant::chess::kill_engine,
            en_croissant::chess::kill_engines,
            en_croissant::chess::get_engine_logs,
            memory_size,
            en_croissant::puzzle::get_puzzle,
            en_croissant::opening::search_opening_name,
            en_croissant::opening::get_opening_from_fen,
            en_croissant::opening::get_opening_from_fens,
            en_croissant::opening::get_opening_from_name,
            en_croissant::db::get_players_game_info,
            en_croissant::chess::get_engine_config,
            en_croissant::fs::file_exists,
            en_croissant::fs::get_file_metadata,
            en_croissant::db::merge_players,
            en_croissant::db::convert_pgn,
            en_croissant::db::get_player,
            en_croissant::pgn::count_pgn_games,
            en_croissant::pgn::read_games,
            en_croissant::lexer::lex_pgn,
            is_bmi2_compatible,
            en_croissant::pgn::delete_game,
            en_croissant::db::delete_duplicated_games,
            en_croissant::db::delete_empty_games,
            en_croissant::db::clear_games,
            en_croissant::fs::set_file_as_executable,
            en_croissant::db::delete_indexes,
            en_croissant::db::create_indexes,
            en_croissant::db::edit_db_info,
            en_croissant::db::delete_db_game,
            en_croissant::db::write_db_game,
            en_croissant::db::delete_database,
            en_croissant::db::export_to_pgn,
            en_croissant::oauth::authenticate,
            en_croissant::pgn::write_game,
            en_croissant::fs::download_file,
            en_croissant::db::get_tournaments,
            en_croissant::db::get_db_info,
            en_croissant::db::get_games,
            en_croissant::db::search::search_position,
            en_croissant::db::get_players,
            en_croissant::puzzle::get_puzzle_db_info,
            en_croissant::puzzle::get_puzzle_themes,
            en_croissant::puzzle::get_themes_for_puzzle,
            en_croissant::puzzle::delete_puzzle_database,
            en_croissant::game::start_game,
            en_croissant::game::get_game_state,
            en_croissant::game::make_game_move,
            en_croissant::game::take_back_game_move,
            en_croissant::game::resign_game,
            en_croissant::game::abort_game,
            en_croissant::game::get_game_engine_logs,
            en_croissant::db::preload_reference_db,
            en_croissant::progress::get_progress,
            en_croissant::progress::clear_progress,
            en_croissant::sound::get_sound_server_port
        ))
        .events(tauri_specta::collect_events!(
            BestMovesPayload,
            DatabaseProgress,
            ProgressEvent,
            GameMoveEvent,
            ClockUpdateEvent,
            GameOverEvent
        ));

    #[cfg(debug_assertions)]
    specta_builder
        .export(
            Typescript::default().bigint(BigIntExportBehavior::BigInt),
            "../src/bindings/generated.ts",
        )
        .expect("Failed to export types");

    #[cfg(debug_assertions)]
    let log_targets = [TargetKind::Stdout, TargetKind::Webview];

    #[cfg(not(debug_assertions))]
    let log_targets = [
        TargetKind::Stdout,
        TargetKind::LogDir {
            file_name: Some(String::from("en-croissant.log")),
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            if let Some(file) = file_from_args(&args, &cwd) {
                if let Err(err) = app.emit_to("main", "open-cli-file", file) {
                    log::error!("Failed to forward command-line file: {err}");
                }
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .targets(log_targets.map(Target::new))
                .level(LevelFilter::Info)
                .build(),
        )
        .invoke_handler(specta_builder.invoke_handler())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .setup(move |app| {
            log::info!("Setting up application");

            // #[cfg(any(windows, target_os = "macos"))]
            // set_shadow(&app.get_webview_window("main").unwrap(), true).unwrap();

            specta_builder.mount_events(app);

            #[cfg(target_os = "linux")]
            {
                let sound_dir = app
                    .path()
                    .resolve("sound", tauri::path::BaseDirectory::Resource)
                    .expect("failed to resolve sound resource directory");
                let port = sound::start_sound_server(sound_dir);
                app.manage(sound::SoundServerPort(port));
            }
            #[cfg(not(target_os = "linux"))]
            app.manage(sound::SoundServerPort(0));

            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_cli::init())?;

            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            log::info!("Finished rust initialization");

            Ok(())
        })
        .manage(AppState::default())
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                let state = app.state::<AppState>();
                for entry in state.engine_processes.iter() {
                    if let Ok(mut process) = entry.value().try_lock() {
                        process.kill_sync();
                    }
                }
            }
        });
}

#[cfg_attr(feature = "tauri", tauri::command)]
#[cfg_attr(feature = "tauri", specta::specta)]
fn is_bmi2_compatible() -> bool {
    #[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
    if is_x86_feature_detected!("bmi2") {
        return true;
    }
    false
}

#[cfg_attr(feature = "tauri", tauri::command)]
#[cfg_attr(feature = "tauri", specta::specta)]
fn memory_size() -> u32 {
    let total_bytes = sysinfo::System::new_all().total_memory();
    (total_bytes / 1024 / 1024) as u32
}
