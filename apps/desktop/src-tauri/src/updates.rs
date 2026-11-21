//! In-app updates (tauri-plugin-updater, signed bundles).
//!
//! - `backend` source: `<saas>/api/desktop/updates/{{target}}/{{arch}}/{{current_version}}?channel=`
//!   with the signed-in account's token (Rust adds it; the webview never
//!   sees it). The backend answers 204 or a 5-minute URL from the private
//!   releases bucket — the token is removed before that download.
//! - `static` source: the public manifest URL (`NEXT_PUBLIC_DESKTOP_UPDATE_URL`,
//!   `{channel}` replaced by the channel).
//!
//! Only when the build carries an updater public key
//! (`DESKTOP_UPDATER_PUBLIC_KEY`); dev builds without one have no updater.

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_updater::{Update, UpdaterExt};
use url::Url;

use crate::auth::AuthState;
use crate::config::RuntimeConfig;

/// Download progress, emitted as `desktop://update-progress`.
pub const UPDATE_PROGRESS_EVENT: &str = "desktop://update-progress";

#[derive(Default)]
pub struct UpdateState {
    pending: Mutex<Option<Update>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    pub current_version: String,
    pub notes: Option<String>,
    pub date: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Progress {
    downloaded: u64,
    total: Option<u64>,
}

/// The endpoint for `channel` — `None` when updates are off in this build.
pub fn endpoint(config: &RuntimeConfig, channel: &str) -> Option<Url> {
    let updates = &config.updates;
    if updates.pubkey.is_none() || !updates.channels.iter().any(|c| c == channel) {
        return None;
    }
    match updates.source.as_str() {
        // `{channel}` in the static URL selects the channel's manifest.
        "static" => updates
            .static_url
            .as_deref()
            .and_then(|raw| Url::parse(&raw.replace("{channel}", channel)).ok()),
        _ => {
            let saas = Url::parse(config.saas_url.as_deref()?).ok()?;
            let mut url = saas
                .join("/api/desktop/updates/{{target}}/{{arch}}/{{current_version}}")
                .ok()?;
            url.query_pairs_mut().append_pair("channel", channel);
            Some(url)
        }
    }
}

/// Whether this build can update itself, and its channels.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatesStatus {
    pub enabled: bool,
    pub channels: Vec<String>,
    pub default_channel: String,
    pub check_interval_hours: u32,
}

#[tauri::command]
pub fn updates_status(config: State<'_, RuntimeConfig>) -> UpdatesStatus {
    let updates = &config.updates;
    UpdatesStatus {
        enabled: endpoint(&config, &updates.default_channel).is_some(),
        channels: updates.channels.clone(),
        default_channel: updates.default_channel.clone(),
        check_interval_hours: updates.check_interval_hours,
    }
}

#[tauri::command]
pub async fn updates_check(
    app: AppHandle,
    auth: State<'_, AuthState>,
    state: State<'_, UpdateState>,
    config: State<'_, RuntimeConfig>,
    channel: Option<String>,
) -> Result<Option<UpdateInfo>, String> {
    let channel = channel.unwrap_or_else(|| config.updates.default_channel.clone());
    let Some(url) = endpoint(&config, &channel) else {
        return Ok(None);
    };
    let mut builder = app
        .updater_builder()
        .endpoints(vec![url])
        .map_err(|e| e.to_string())?;
    if config.updates.source != "static" {
        if let Some(token) = auth.bearer(&app).await {
            builder = builder
                .header("Authorization", format!("Bearer {token}"))
                .map_err(|e| e.to_string())?;
        }
    }
    let update = builder
        .build()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?;
    let info = update.as_ref().map(|u| UpdateInfo {
        version: u.version.clone(),
        current_version: u.current_version.clone(),
        notes: u.body.clone(),
        date: u.date.map(|d| d.to_string()),
    });
    *state.pending.lock().unwrap_or_else(|p| p.into_inner()) = update;
    Ok(info)
}

/// Downloads + installs the update found by `updates_check`; the webview
/// then restarts the app (`@tauri-apps/plugin-process` `relaunch`).
#[tauri::command]
pub async fn updates_install(app: AppHandle, state: State<'_, UpdateState>) -> Result<(), String> {
    let Some(mut update) = state
        .pending
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .take()
    else {
        return Err("no update pending".into());
    };
    // The download URL is a presigned storage URL — never send it the token.
    update.headers.remove(reqwest::header::AUTHORIZATION);
    let mut downloaded: u64 = 0;
    let on_chunk = |chunk: usize, total: Option<u64>| {
        downloaded += chunk as u64;
        let _ = app.emit(UPDATE_PROGRESS_EVENT, Progress { downloaded, total });
    };
    // A debug binary is not inside an installed bundle: the updater would
    // replace `target/debug` with the new app. Download + verify the
    // signature only, so the whole flow stays testable.
    if cfg!(debug_assertions) {
        let bytes = update
            .download(on_chunk, || {})
            .await
            .map_err(|e| e.to_string())?;
        log::info!(
            "debug build: update {} downloaded and verified ({} bytes), not installed",
            update.version,
            bytes.len()
        );
        // Kept, so "Update" can be tried again.
        *state.pending.lock().unwrap_or_else(|p| p.into_inner()) = Some(update);
        return Err(DEBUG_NOT_INSTALLED.into());
    }
    update
        .download_and_install(on_chunk, || log::info!("update downloaded, installing"))
        .await
        .map_err(|e| e.to_string())
}

/// `updates_install` result of a debug build (download verified, not installed).
pub const DEBUG_NOT_INSTALLED: &str = "debug build: update verified, not installed";

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::UpdatesConfig;

    fn config(source: &str) -> RuntimeConfig {
        RuntimeConfig {
            saas_url: Some("https://app.example.com".into()),
            updates: UpdatesConfig {
                source: source.into(),
                static_url: Some("https://cdn.example.com/{channel}/latest.json".into()),
                channels: vec!["stable".into(), "beta".into()],
                default_channel: "stable".into(),
                pubkey: Some("pk".into()),
                check_interval_hours: 6,
            },
            ..RuntimeConfig::default()
        }
    }

    #[test]
    fn backend_endpoint_keeps_tauri_placeholders_and_the_channel() {
        let url = endpoint(&config("backend"), "beta").unwrap().to_string();
        assert!(url.starts_with("https://app.example.com/api/desktop/updates/"));
        // Tauri replaces both the raw and the percent-encoded form.
        assert!(url.contains("target") && url.contains("current_version"));
        assert!(url.ends_with("?channel=beta"));
    }

    #[test]
    fn no_updater_without_a_key_or_for_unknown_channels() {
        let mut c = config("backend");
        assert!(endpoint(&c, "nightly").is_none());
        c.updates.pubkey = None;
        assert!(endpoint(&c, "stable").is_none());
    }

    #[test]
    fn static_source_uses_the_public_manifest() {
        assert_eq!(
            endpoint(&config("static"), "stable").unwrap().as_str(),
            "https://cdn.example.com/stable/latest.json"
        );
    }
}
