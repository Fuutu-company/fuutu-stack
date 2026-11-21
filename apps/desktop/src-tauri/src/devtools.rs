//! Agent automation bridge — compiled only into debug builds with the
//! `devtools` feature (see `Cargo.toml`). Never part of a release build:
//! `apps/desktop/scripts/check-release-clean.mjs` proves it.
//!
//! Binds to 127.0.0.1 on the port-slot port (`FUUTU_DESKTOP_BRIDGE_PORT`)
//! and only accepts clients presenting `FUUTU_DESKTOP_BRIDGE_TOKEN`
//! (vendored plugin patch, `vendor/tauri-plugin-mcp-bridge/PATCHES.md`).

use std::net::TcpListener;
use tauri::{plugin::TauriPlugin, Runtime};

const DEFAULT_PORT: u16 = 9223;

/// The bridge plugin, or `None` when the slot port is taken — the plugin
/// would otherwise wander to another port (possibly one of the slot's E2E
/// or CDP ports) where the MCP server never looks.
pub fn plugin<R: Runtime>() -> Option<TauriPlugin<R>> {
    let port = std::env::var("FUUTU_DESKTOP_BRIDGE_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(DEFAULT_PORT);
    if TcpListener::bind(("127.0.0.1", port)).is_err() {
        log::error!(
            "automation bridge disabled: 127.0.0.1:{port} is in use (another desktop app instance?)"
        );
        return None;
    }
    Some(
        tauri_plugin_mcp_bridge::Builder::new()
            .bind_address("127.0.0.1")
            .base_port(port)
            .build(),
    )
}
