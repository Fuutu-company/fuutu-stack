// The automation bridge must never reach a release build: a release with
// the feature on does not compile (scripts/check-release-clean.mjs also
// scans the built binary).
#[cfg(all(not(debug_assertions), feature = "devtools"))]
compile_error!("the `devtools` feature is for debug builds only (pnpm dev:desktop)");

pub mod config;
mod shell;

#[cfg(all(debug_assertions, feature = "devtools"))]
mod devtools;

use config::RuntimeConfig;
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};

/// 5 MB per log file, the last few kept (`<app log dir>/<bundle id>.log`).
const LOG_FILE_MAX_BYTES: u128 = 5 * 1024 * 1024;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config = RuntimeConfig::embedded();
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
                .with_denylist(&["about"])
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init());

    if config.shell.autostart {
        builder = builder.plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ));
    }

    #[cfg(all(debug_assertions, feature = "devtools"))]
    if let Some(bridge) = devtools::plugin() {
        builder = builder.plugin(bridge);
    }

    let shell_config = config.shell.clone();
    let tooltip = config.identity.product_name.clone();
    builder
        .manage(config)
        .invoke_handler(tauri::generate_handler![shell::shell_set_tray_labels])
        .setup(move |app| {
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
