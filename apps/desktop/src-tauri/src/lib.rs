// The automation bridge must never reach a release build: a release with
// the feature on does not compile (scripts/check-release-clean.mjs also
// scans the built binary).
#[cfg(all(not(debug_assertions), feature = "devtools"))]
compile_error!("the `devtools` feature is for debug builds only (pnpm dev:desktop)");

#[cfg(all(debug_assertions, feature = "devtools"))]
mod devtools;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(all(debug_assertions, feature = "devtools"))]
    let builder = builder.plugin(devtools::plugin());

    builder
        .run(tauri::generate_context!())
        .expect("error while running the desktop app");
}
