//! Window shell: tray, close-to-tray, single instance focus.

use std::collections::HashSet;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, Runtime, WindowEvent,
};

use crate::config::RuntimeConfig;

pub const MAIN_WINDOW: &str = "main";
const TRAY_ID: &str = "main";
/// Tray menu ids the kit handles itself; app items may not use them.
const KIT_TRAY_IDS: [&str; 2] = ["show", "quit"];

/// One tray menu entry of your app (`app_plugins::tray_items`), placed
/// between the kit's "Show" and "Quit". A click calls
/// `app_plugins::on_tray_menu` with its `id`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrayItem {
    pub id: String,
    pub label: String,
    pub enabled: bool,
}

// Used by app_plugins.rs (empty in the kit).
#[allow(dead_code)]
impl TrayItem {
    pub fn new(id: impl Into<String>, label: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            enabled: true,
        }
    }

    pub fn disabled(mut self) -> Self {
        self.enabled = false;
        self
    }
}

/// Drops app items with a kit id ("show", "quit"), an empty id or an id
/// already used, keeping the first; each drop is logged.
fn app_tray_items(items: Vec<TrayItem>) -> Vec<TrayItem> {
    let mut seen: HashSet<String> = HashSet::new();
    items
        .into_iter()
        .filter(|item| {
            let ok = !item.id.is_empty()
                && !KIT_TRAY_IDS.contains(&item.id.as_str())
                && seen.insert(item.id.clone());
            if !ok {
                log::warn!(
                    "tray item {:?} skipped: reserved, empty or duplicate id",
                    item.id
                );
            }
            ok
        })
        .collect()
}

/// Shows, unminimises and focuses the main window.
pub fn focus_main<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn tray_menu<R: Runtime>(app: &AppHandle<R>, show: &str, quit: &str) -> tauri::Result<Menu<R>> {
    let menu = Menu::new(app)?;
    menu.append(&MenuItem::with_id(app, "show", show, true, None::<&str>)?)?;
    // Your entries (app-owned src/app_plugins.rs), rebuilt with the menu
    // (e.g. on a UI language change).
    let items = match app.try_state::<RuntimeConfig>() {
        Some(config) => app_tray_items(crate::app_plugins::tray_items(app, config.inner())),
        None => Vec::new(),
    };
    if !items.is_empty() {
        menu.append(&PredefinedMenuItem::separator(app)?)?;
        for item in &items {
            menu.append(&MenuItem::with_id(
                app,
                item.id.as_str(),
                item.label.as_str(),
                item.enabled,
                None::<&str>,
            )?)?;
        }
        menu.append(&PredefinedMenuItem::separator(app)?)?;
    }
    menu.append(&MenuItem::with_id(app, "quit", quit, true, None::<&str>)?)?;
    Ok(menu)
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
            other => crate::app_plugins::on_tray_menu(app, other),
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

/// Tray labels in the UI language (the webview sends them on locale change).
#[tauri::command]
pub fn shell_set_tray_labels<R: Runtime>(
    app: AppHandle<R>,
    show: String,
    quit: String,
) -> Result<(), String> {
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

/// macOS: WKWebView's `tabFocusesLinks` defaults to NO, so Tab skips
/// plain links (`<a href>`: sidebar, home tiles, About). Turn it on for
/// every webview the app creates, like Safari's "Press Tab to highlight
/// each item". The preferences object is shared with the live webview, so
/// setting it after creation takes effect.
#[cfg(target_os = "macos")]
pub fn tab_focuses_links<R: Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("kit-tab-focus")
        .on_webview_ready(|webview| {
            let result = webview.with_webview(|platform| {
                let view = platform.inner().cast::<objc2_web_kit::WKWebView>();
                // SAFETY: on macOS `inner()` is the live WKWebView, and
                // with_webview runs this on the main thread.
                unsafe {
                    if let Some(view) = view.as_ref() {
                        view.configuration().preferences().setTabFocusesLinks(true);
                    }
                }
            });
            if let Err(err) = result {
                log::warn!("tabFocusesLinks not set: {err}");
            }
        })
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_tray_items_keep_order_and_drop_reserved_empty_and_duplicate_ids() {
        let kept = app_tray_items(vec![
            TrayItem::new("show", "Mine"),
            TrayItem::new("a", "A"),
            TrayItem::new("", "Empty"),
            TrayItem::new("quit", "Mine too"),
            TrayItem::new("b", "B").disabled(),
            TrayItem::new("a", "A again"),
        ]);
        assert_eq!(
            kept,
            vec![TrayItem::new("a", "A"), TrayItem::new("b", "B").disabled()]
        );
    }

    #[test]
    fn no_app_items_leave_the_kit_menu_alone() {
        assert!(app_tray_items(Vec::new()).is_empty());
    }
}
