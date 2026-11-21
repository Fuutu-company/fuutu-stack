// Your build steps (app-owned app_build.rs).
#[path = "app_build.rs"]
mod app_build;
// Permissions of the Tauri plugins in app-ext (see the file).
#[path = "build_forward.rs"]
mod build_forward;

fn main() {
    // Desktop behaviour from desktopConfig (`apps/desktop/scripts/run.ts`
    // sets it); rebuild when it changes.
    println!("cargo:rerun-if-env-changed=FUUTU_DESKTOP_CONFIG");
    println!("cargo:rerun-if-changed=app_build.rs");
    println!("cargo:rerun-if-changed=build_forward.rs");
    // `frontendDist` (../out) must exist for `generate_context!` — a plain
    // `cargo check` / `cargo test` (CI, no web build) gets an empty one.
    let _ = std::fs::create_dir_all("../out");
    app_build::run();
    build_forward::import_app_ext_plugin_permissions();
    tauri_build::build()
}
