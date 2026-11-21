// Forwards the Tauri plugin permissions of the app-owned `app-ext` crate to
// the kit crate (kit-owned; used by both build scripts).
//
// tauri-build reads a plugin's permissions only from the build-script
// environment of the app crate: `DEP_<LINKS>_PERMISSION_FILES_PATH` (and
// `_GLOBAL_SCOPE_SCHEMA_PATH`), which cargo sets for DIRECT dependencies
// only. A plugin your `app-ext` depends on is not one, so:
//
// 1. `app-ext/build.rs` re-exports its dependencies' keys under its own
//    `links = "app-ext"` (`reexport_plugin_permissions`);
// 2. the kit `build.rs` restores the original names before
//    `tauri_build::build()` (`import_app_ext_plugin_permissions`).

const KEYS: [&str; 2] = ["_PERMISSION_FILES_PATH", "_GLOBAL_SCOPE_SCHEMA_PATH"];
const APP_EXT: &str = "DEP_APP_EXT_";

fn is_plugin_key(key: &str) -> bool {
    KEYS.iter().any(|suffix| key.ends_with(suffix))
}

/// `cargo:` metadata lines that re-export the plugin keys app-ext sees.
#[allow(dead_code)]
pub fn reexports(vars: impl Iterator<Item = (String, String)>) -> Vec<String> {
    let mut lines: Vec<String> = vars
        .filter(|(key, _)| !key.starts_with(APP_EXT) && is_plugin_key(key))
        .filter_map(|(key, value)| {
            key.strip_prefix("DEP_")
                .map(|name| format!("cargo:{name}={value}"))
        })
        .collect();
    lines.sort();
    lines
}

/// Environment variables the kit build script sets: each forwarded key
/// under its original `DEP_<plugin>_…` name, unless already set (a plugin
/// the kit depends on itself).
#[allow(dead_code)]
pub fn imports(
    vars: impl Iterator<Item = (String, String)>,
    is_set: impl Fn(&str) -> bool,
) -> Vec<(String, String)> {
    let mut out: Vec<(String, String)> = vars
        .filter(|(key, _)| is_plugin_key(key))
        .filter_map(|(key, value)| {
            key.strip_prefix(APP_EXT)
                .map(|rest| (format!("DEP_{rest}"), value))
        })
        .filter(|(key, _)| !is_set(key))
        .collect();
    out.sort();
    out
}

/// In app-ext's build script.
#[allow(dead_code)]
pub fn reexport_plugin_permissions() {
    for line in reexports(std::env::vars()) {
        println!("{line}");
    }
}

/// In the kit build script, before `tauri_build::build()`.
#[allow(dead_code)]
pub fn import_app_ext_plugin_permissions() {
    for (key, value) in imports(std::env::vars(), |key| std::env::var_os(key).is_some()) {
        // Build scripts are single-threaded here; tauri-build reads the
        // process environment.
        std::env::set_var(&key, value);
    }
    // tauri-build would also list them as `app-ext-tauri-plugin-…`.
    for (key, _) in std::env::vars() {
        if key.starts_with(APP_EXT) && is_plugin_key(&key) {
            std::env::remove_var(key);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn vars(list: &[(&str, &str)]) -> impl Iterator<Item = (String, String)> {
        list.iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect::<Vec<_>>()
            .into_iter()
    }

    #[test]
    fn app_ext_reexports_its_plugins_permission_keys_only() {
        let lines = reexports(vars(&[
            ("DEP_TAURI_PLUGIN_FS_PERMISSION_FILES_PATH", "/o/fs"),
            ("DEP_TAURI_PLUGIN_FS_GLOBAL_SCOPE_SCHEMA_PATH", "/o/fs.json"),
            ("DEP_TAURI_DEV", "true"),
            ("PATH", "/bin"),
        ]));
        assert_eq!(
            lines,
            vec![
                "cargo:TAURI_PLUGIN_FS_GLOBAL_SCOPE_SCHEMA_PATH=/o/fs.json",
                "cargo:TAURI_PLUGIN_FS_PERMISSION_FILES_PATH=/o/fs",
            ]
        );
    }

    #[test]
    fn the_kit_restores_the_original_names_without_overriding_its_own() {
        let set = imports(
            vars(&[
                ("DEP_APP_EXT_TAURI_PLUGIN_FS_PERMISSION_FILES_PATH", "/o/fs"),
                ("DEP_APP_EXT_TAURI_PLUGIN_OPENER_PERMISSION_FILES_PATH", "/o/op2"),
                ("DEP_APP_EXT_OTHER", "x"),
            ]),
            |key| key == "DEP_TAURI_PLUGIN_OPENER_PERMISSION_FILES_PATH",
        );
        assert_eq!(
            set,
            vec![(
                "DEP_TAURI_PLUGIN_FS_PERMISSION_FILES_PATH".to_string(),
                "/o/fs".to_string()
            )]
        );
    }
}
