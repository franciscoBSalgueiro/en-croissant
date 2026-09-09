//! Runtime-neutral handles used in command signatures.
//! Under `tauri` these are the Tauri types; under `server` they are plain references.

#[cfg(feature = "tauri")]
pub type AppCtx = tauri::AppHandle;
#[cfg(feature = "tauri")]
pub type AppStateRef<'r> = tauri::State<'r, crate::AppState>;

#[cfg(feature = "server")]
pub use server::*;

#[cfg(feature = "server")]
mod server {
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::Arc;

    use serde::Serialize;
    use tokio::sync::broadcast;

    use crate::error::Error;
    use crate::AppState;

    pub type AppCtx = ServerCtx;
    pub type AppStateRef<'r> = &'r AppState;

    /// One message on the /ws/events socket.
    #[derive(Clone, Debug, Serialize)]
    pub struct EventEnvelope {
        pub event: String,
        pub id: u64,
        pub payload: serde_json::Value,
    }

    #[derive(Clone)]
    pub struct ServerCtx {
        pub state: Arc<AppState>,
        pub events: broadcast::Sender<EventEnvelope>,
        pub data_dir: PathBuf,
        next_id: Arc<AtomicU64>,
    }

    impl ServerCtx {
        pub fn new(
            state: Arc<AppState>,
            data_dir: PathBuf,
        ) -> (Self, broadcast::Receiver<EventEnvelope>) {
            let (tx, rx) = broadcast::channel(1024);
            (
                Self {
                    state,
                    events: tx,
                    data_dir,
                    next_id: Arc::new(AtomicU64::new(1)),
                },
                rx,
            )
        }

        /// Broadcast an event. Having no listeners is not an error.
        pub fn emit<S: Serialize>(&self, event: &str, payload: S) -> Result<(), Error> {
            let envelope = EventEnvelope {
                event: event.to_string(),
                id: self.next_id.fetch_add(1, Ordering::Relaxed),
                payload: serde_json::to_value(payload)?,
            };
            let _ = self.events.send(envelope);
            Ok(())
        }
    }

    /// Server-side stand-in for `tauri_specta::Event`: same method name so call
    /// sites `.emit(&app)?` compile under both features.
    pub trait WebEvent: Serialize {
        const NAME: &'static str;
        fn emit(&self, ctx: &ServerCtx) -> Result<(), Error> {
            ctx.emit(Self::NAME, self)
        }
    }
}

/// Declare the WebSocket event name for a payload struct (server feature only).
#[macro_export]
macro_rules! web_event {
    ($ty:ty, $name:literal) => {
        #[cfg(feature = "server")]
        impl $crate::ctx::WebEvent for $ty {
            const NAME: &'static str = $name;
        }
    };
}
