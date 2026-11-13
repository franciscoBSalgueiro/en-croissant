use gtk::prelude::*;

pub fn prepare_title_bar(window: &gtk::ApplicationWindow) {
    // On Wayland, GTK negotiates server-side decorations unless a client-side
    // title bar is installed. set_decorated(false) alone does not remove KDE's
    // frame when the window was created with decorations enabled.
    if window.display().type_().name() != "GdkWaylandDisplay" || window.titlebar().is_some() {
        return;
    }

    // Keep a real header available for the Native title-bar preference. GTK
    // hides it when the frontend selects Custom via setDecorations(false).
    let header = gtk::HeaderBar::builder()
        .title("En Croissant")
        .show_close_button(true)
        .decoration_layout("menu:minimize,maximize,close")
        .build();
    window.set_titlebar(Some(&header));
}
