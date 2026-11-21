//! Window shell: tray, close-to-tray, single instance focus.

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, Runtime, WindowEvent,
};

pub const MAIN_WINDOW: &str = "main";
const TRAY_ID: &str = "main";

/// Shows, unminimises and focuses the main window.
pub fn focus_main<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn tray_menu<R: Runtime>(app: &AppHandle<R>, show: &str, quit: &str) -> tauri::Result<Menu<R>> {
    let show = MenuItem::with_id(app, "show", show, true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", quit, true, None::<&str>)?;
    Menu::with_items(app, &[&show, &quit])
}

pub fn setup_tray<R: Runtime>(app: &AppHandle<R>, tooltip: &str) -> tauri::Result<()> {
    let menu = tray_menu(app, "Show", "Quit")?;
    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip(tooltip)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => focus_main(app),
            "quit" => app.exit(0),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

/// Tray labels in the UI language (the webview sends them on locale change).
#[tauri::command]
pub fn shell_set_tray_labels<R: Runtime>(app: AppHandle<R>, show: String, quit: String) -> Result<(), String> {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return Ok(());
    };
    let menu = tray_menu(&app, &show, &quit).map_err(|e| e.to_string())?;
    tray.set_menu(Some(menu)).map_err(|e| e.to_string())
}

/// Closing the main window hides it instead (the tray brings it back).
pub fn hide_on_close<R: Runtime>(window: &tauri::Window<R>, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        if window.label() == MAIN_WINDOW {
            api.prevent_close();
            let _ = window.hide();
        }
    }
}
