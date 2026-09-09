#[cfg(feature = "server")]
use crate::ctx::WebEvent as _;
use crate::ctx::{AppCtx, AppStateRef};
use dashmap::DashMap;
use serde::Serialize;
use specta::Type;
#[cfg(feature = "tauri")]
use tauri_specta::Event;

use crate::error::Error;

#[derive(Clone, Debug, Serialize, Type)]
pub struct ProgressItem {
    pub id: String,
    pub progress: f32,
    pub finished: bool,
}

#[derive(Clone, Debug, Serialize, Type)]
#[cfg_attr(feature = "tauri", derive(tauri_specta::Event))]
pub struct ProgressEvent {
    pub id: String,
    pub progress: f32,
    pub finished: bool,
}
crate::web_event!(ProgressEvent, "progress-event");

pub type ProgressStore = DashMap<String, ProgressItem>;

pub fn update_progress(
    store: &ProgressStore,
    app: &AppCtx,
    id: String,
    progress: f32,
    finished: bool,
) -> Result<(), Error> {
    let item = ProgressItem {
        id: id.clone(),
        progress,
        finished,
    };

    store.insert(id.clone(), item.clone());

    ProgressEvent {
        id: item.id,
        progress: item.progress,
        finished: item.finished,
    }
    .emit(app)?;

    Ok(())
}

#[cfg_attr(feature = "tauri", tauri::command)]
#[cfg_attr(feature = "tauri", specta::specta)]
pub fn get_progress(id: String, state: AppStateRef<'_>) -> Option<ProgressItem> {
    state.progress_state.get(&id).map(|v| v.clone())
}

#[cfg_attr(feature = "tauri", tauri::command)]
#[cfg_attr(feature = "tauri", specta::specta)]
pub fn clear_progress(id: String, state: AppStateRef<'_>) {
    state.progress_state.remove(&id);
}
