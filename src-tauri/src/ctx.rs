//! Runtime-neutral handles used in command signatures.
//! Under `tauri` these are the Tauri types; under `server` they are plain references.

#[cfg(feature = "tauri")]
pub type AppCtx = tauri::AppHandle;
#[cfg(feature = "tauri")]
pub type AppStateRef<'r> = tauri::State<'r, crate::AppState>;
