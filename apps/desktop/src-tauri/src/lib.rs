// The automation bridge must never reach a release build: a release with
// the feature on does not compile (scripts/check-release-clean.mjs also
// scans the built binary).
#[cfg(all(not(debug_assertions), feature = "devtools"))]
compile_error!("the `devtools` feature is for debug builds only (pnpm dev:desktop)");

mod app_plugins;
// Unit tests of the build scripts' plugin-permission forwarding.
mod auth;
#[cfg(test)]
#[path = "../build_forward.rs"]
mod build_forward;
pub mod config;
mod shell;
mod updates;

#[cfg(all(debug_assertions, feature = "devtools"))]
mod devtools;

// Silences cargo's unused-dependency warning while app-ext is still empty.
use app_ext as _;
use config::RuntimeConfig;
use tauri::Manager;
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};

/// 5 MB per log file, the last few kept (`<app log dir>/<bundle id>.log`).
const LOG_FILE_MAX_BYTES: u128 = 5 * 1024 * 1024;

/// Window state the kit saves and restores: everything but visibility.
/// Restoring VISIBLE calls show() + set_focus() on every start, so a window
/// configured `visible: false` (shown by the app after its first paint)
/// would flash white.
fn window_state_flags() -> tauri_plugin_window_state::StateFlags {
    use tauri_plugin_window_state::StateFlags;
    StateFlags::all() & !StateFlags::VISIBLE
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config = RuntimeConfig::embedded();
    auth::init_tls();
    let mut builder = tauri::Builder::default();

    // Must be the first plugin: a second launch hands over and exits.
    if config.shell.single_instance {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            shell::focus_main(app);
        }));
    }

    builder = builder
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir { file_name: None }),
                ])
                .max_file_size(LOG_FILE_MAX_BYTES)
                .rotation_strategy(RotationStrategy::KeepSome(3))
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(window_state_flags())
                .with_denylist(&["about"])
                .build(),
        )
        // `<scheme>://` links: sign-in fallback + "back to the app" after a
        // purchase in the browser (src/auth). With single-instance on, a
        // link that starts a second process is forwarded here.
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init());

    if config.shell.autostart {
        builder = builder.plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ));
    }

    // Signed updates — only in builds with an updater key.
    if let Some(pubkey) = config.updates.pubkey.clone() {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().pubkey(pubkey).build());
    }

    // Your plugins (app-owned src/app_plugins.rs), with the runtime config.
    builder = app_plugins::register(builder, &config);

    #[cfg(all(debug_assertions, feature = "devtools"))]
    if let Some(bridge) = devtools::plugin() {
        builder = builder.plugin(bridge);
    }

    let shell_config = config.shell.clone();
    let tooltip = config.identity.product_name.clone();
    builder
        .manage(config)
        .manage(updates::UpdateState::default())
        .invoke_handler(tauri::generate_handler![
            shell::shell_set_tray_labels,
            auth::auth_status,
            auth::auth_sign_in,
            auth::auth_cancel_sign_in,
            auth::auth_sign_out,
            auth::auth_api_fetch,
            auth::auth_session,
            updates::updates_status,
            updates::updates_check,
            updates::updates_install,
        ])
        .setup(move |app| {
            let handle = app.handle().clone();
            let user_agent = format!("{}/{}", tooltip, app.package_info().version);
            let auth = auth::AuthState::new(
                app.state::<RuntimeConfig>().inner(),
                &user_agent,
                auth::data_dir(&handle),
            );
            app.manage(auth);
            setup_deep_links(&handle);
            if shell_config.tray {
                shell::setup_tray(app.handle(), &tooltip)?;
            }
            log::info!("desktop app started");
            Ok(())
        })
        .on_window_event(move |window, event| {
            if shell_config.close_to_tray {
                shell::hide_on_close(window, event);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running the desktop app");
}

fn setup_deep_links(app: &tauri::AppHandle) {
    // macOS registers the scheme from the bundle (Info.plist); Linux and
    // Windows dev runs register it at runtime.
    #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
    if let Err(err) = app.deep_link().register_all() {
        log::warn!("deep link registration failed: {err}");
    }
    let handle = app.clone();
    app.deep_link().on_open_url(move |event| {
        for url in event.urls() {
            auth::handle_deep_link(&handle, &url);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::window_state_flags;
    use tauri_plugin_window_state::StateFlags;

    #[test]
    fn window_state_never_restores_visibility() {
        // Restoring VISIBLE calls show() + set_focus() on every start, so a
        // window configured `visible: false` would flash before its first paint.
        let flags = window_state_flags();
        assert!(!flags.contains(StateFlags::VISIBLE));
        assert!(flags.contains(
            StateFlags::SIZE
                | StateFlags::POSITION
                | StateFlags::MAXIMIZED
                | StateFlags::DECORATIONS
                | StateFlags::FULLSCREEN
        ));
    }
}
