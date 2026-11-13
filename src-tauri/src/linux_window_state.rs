use std::{cell::Cell, collections::HashMap};

use gtk::prelude::*;
use serde::Deserialize;
use tauri::Manager;
use tauri_plugin_window_state::AppHandleExt;

#[derive(Clone, Copy, Deserialize)]
struct SavedSize {
    width: u32,
    height: u32,
    #[serde(default)]
    maximized: bool,
    #[serde(default)]
    fullscreen: bool,
}

fn logical_size(size: SavedSize, scale: i32, insets: (i32, i32)) -> (i32, i32) {
    let convert = |physical, inset: i32| {
        ((physical as f64 / f64::from(scale.max(1))).round() as i32)
            .saturating_sub(inset.max(0))
            .max(1)
    };
    (
        convert(size.width, insets.0),
        convert(size.height, insets.1),
    )
}

fn restore_size_when_mapped(native: &gtk::ApplicationWindow, size: SavedSize) {
    native.add_tick_callback(move |native, _| {
        let Some(buffer) = native.window().filter(|_| native.is_mapped()) else {
            return gtk::glib::ControlFlow::Continue;
        };
        let Some(monitor) = native.display().monitor_at_window(&buffer) else {
            return gtk::glib::ControlFlow::Continue;
        };
        if native.scale_factor() != monitor.scale_factor() {
            return gtk::glib::ControlFlow::Continue;
        }
        // A hidden GTK window uses the primary monitor's scale. Wait until
        // Wayland assigns the actual output, and exclude CSD shadows:
        // resize() expects the frame size rather than the buffer size.
        let current = native.size();
        let insets = (buffer.width() - current.0, buffer.height() - current.1);
        let target = logical_size(size, native.scale_factor(), insets);
        if current != target {
            native.resize(target.0, target.1);
        }
        gtk::glib::ControlFlow::Break
    });
}

pub fn show(window: &tauri::WebviewWindow) -> Result<(), String> {
    let saved_size = (|| {
        let state_path = window
            .app_handle()
            .path()
            .app_config_dir()
            .ok()?
            .join(window.app_handle().filename());
        let states: HashMap<String, SavedSize> =
            serde_json::from_slice(&std::fs::read(state_path).ok()?).ok()?;
        states
            .get(window.label())
            .copied()
            .filter(|size| size.width > 0 && size.height > 0)
    })();
    let main_window = window.clone();
    window
        .run_on_main_thread(move || {
            if let (Some(size), Ok(native)) = (saved_size, main_window.gtk_window()) {
                if size.maximized || size.fullscreen {
                    // Keep the restored state, then correct its normal geometry
                    // when the user unmaximizes or leaves fullscreen.
                    let handled = Cell::new(false);
                    native.connect_window_state_event(move |native, event| {
                        let states =
                            gtk::gdk::WindowState::MAXIMIZED | gtk::gdk::WindowState::FULLSCREEN;
                        if event.changed_mask().intersects(states)
                            && !event.new_window_state().intersects(states)
                            && !handled.replace(true)
                        {
                            restore_size_when_mapped(native, size);
                        }
                        gtk::glib::Propagation::Proceed
                    });
                } else {
                    restore_size_when_mapped(&native, size);
                }
            }
            if let Err(error) = main_window.show() {
                log::error!("Failed to show main window: {error}");
            }
        })
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn size(width: u32, height: u32) -> SavedSize {
        SavedSize {
            width,
            height,
            maximized: false,
            fullscreen: false,
        }
    }

    #[test]
    fn uses_the_mapped_monitors_scale() {
        assert_eq!(logical_size(size(800, 600), 1, (0, 0)), (800, 600));
        assert_eq!(logical_size(size(800, 600), 2, (0, 0)), (400, 300));
    }

    #[test]
    fn excludes_client_side_decoration_shadows() {
        assert_eq!(logical_size(size(452, 352), 1, (52, 52)), (400, 300));
        assert_eq!(logical_size(size(904, 704), 2, (52, 52)), (400, 300));
    }
}
