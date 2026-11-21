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

use crate::config::RuntimeConfig;
use tauri::{Builder, Runtime};

/// Registers the app's own plugins. The kit ships it as identity.
pub fn register<R: Runtime>(builder: Builder<R>, _config: &RuntimeConfig) -> Builder<R> {
    builder
}
