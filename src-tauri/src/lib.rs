#![allow(clippy::module_inception)]

#[cfg(all(feature = "tauri", feature = "server"))]
compile_error!("features `tauri` and `server` are mutually exclusive");

#[cfg(not(any(feature = "tauri", feature = "server")))]
compile_error!("enable exactly one of the `tauri` or `server` features");

pub mod chess;
pub mod ctx;
pub mod db;
pub mod engine;
pub mod error;
pub mod fs;
pub mod lexer;
pub mod opening;
pub mod pgn;
pub mod progress;

#[cfg(feature = "tauri")]
pub mod game;
#[cfg(feature = "tauri")]
pub mod oauth;
#[cfg(feature = "tauri")]
pub mod puzzle;
#[cfg(feature = "tauri")]
pub mod sound;

use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use chess::EngineProcess;
use dashmap::DashMap;
use db::{GameQuery, MmapSearchIndex, NormalizedGame, PositionStats};
use derivative::Derivative;
use progress::ProgressStore;
use tokio::sync::Semaphore;

pub use ctx::{AppCtx, AppStateRef};

#[derive(Derivative)]
#[derivative(Default)]
pub struct AppState {
    pub connection_pool: DashMap<
        String,
        diesel::r2d2::Pool<diesel::r2d2::ConnectionManager<diesel::SqliteConnection>>,
    >,
    pub line_cache: DashMap<(GameQuery, PathBuf), (Vec<PositionStats>, Vec<NormalizedGame>)>,
    pub db_cache: Mutex<Option<MmapSearchIndex>>,
    #[derivative(Default(value = "Arc::new(Semaphore::new(2))"))]
    pub new_request: Arc<Semaphore>,
    #[derivative(Default(value = "DashMap::new()"))]
    pub search_collisions: DashMap<(GameQuery, PathBuf), Arc<tokio::sync::Mutex<()>>>,
    pub pgn_offsets: DashMap<String, Vec<u64>>,

    pub engine_processes: DashMap<(String, String), Arc<tokio::sync::Mutex<EngineProcess>>>,
    pub analysis_cancel_flags: DashMap<String, Arc<AtomicBool>>,
    #[cfg(feature = "tauri")]
    pub auth: oauth::AuthState,
    #[cfg(feature = "tauri")]
    pub game_manager: game::GameManager,
    pub progress_state: ProgressStore,
}
