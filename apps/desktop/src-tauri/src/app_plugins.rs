//! App-owned — the kit never changes this file's content after release;
//! fill it for your app.
//!
//! Your Tauri plugins (and other builder steps), registered once by
//! `lib.rs` after the kit's plugins and before the app starts. `config` is
//! the resolved runtime config (`saas_url`, `identity`, `auth`, …):
//!
//! ```ignore
//! pub fn register<R: Runtime>(builder: Builder<R>, config: &RuntimeConfig) -> Builder<R> {
//!     let builder = builder.plugin(tauri_plugin_fs::init());
//!     my_crate::mount(builder, config.saas_url.as_deref())
//! }
//! ```
//!
//! Add the crates to `../Cargo.toml` (your own ones under `crates/`) and
//! their permissions to `scripts/lib/app-capabilities.ts`.
//!
//! Never register another plugin from inside a plugin's own `setup`
//! (e.g. `app.plugin(...)` in `Builder::setup` of your plugin): it
//! deadlocks the app at startup. Register every plugin here, on the
//! builder.
//!
//! Tray menu (with `desktopConfig.shell.tray`): `tray_items` returns your
//! entries, shown between the kit's "Show" and "Quit" and rebuilt with the
//! menu (start, UI language change) — read your own state through `app`
//! for labels in the user's language. A click on one calls
//! `on_tray_menu` with its id; the kit ids `show` and `quit` are reserved.
//!
//! ```ignore
//! pub fn tray_items<R: Runtime>(_app: &AppHandle<R>, _config: &RuntimeConfig) -> Vec<TrayItem> {
//!     vec![TrayItem::new("new-note", "New note")]
//! }
//!
//! pub fn on_tray_menu<R: Runtime>(app: &AppHandle<R>, id: &str) {
//!     if id == "new-note" {
//!         let _ = app.emit("notes://new", ());
//!     }
//! }
//! ```

use crate::config::RuntimeConfig;
use crate::shell::TrayItem;
use tauri::{AppHandle, Builder, Runtime};

/// Registers the app's own plugins. The kit ships it as identity.
pub fn register<R: Runtime>(builder: Builder<R>, _config: &RuntimeConfig) -> Builder<R> {
    builder
}

/// Your tray menu entries. The kit ships none.
pub fn tray_items<R: Runtime>(_app: &AppHandle<R>, _config: &RuntimeConfig) -> Vec<TrayItem> {
    Vec::new()
}

/// Clicks on your tray entries (ids the kit does not handle).
pub fn on_tray_menu<R: Runtime>(_app: &AppHandle<R>, _id: &str) {}
