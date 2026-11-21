// Your build steps (app-owned app_build.rs).
#[path = "app_build.rs"]
mod app_build;

fn main() {
    // Desktop behaviour from desktopConfig (`apps/desktop/scripts/run.ts`
    // sets it); rebuild when it changes.
    println!("cargo:rerun-if-env-changed=FUUTU_DESKTOP_CONFIG");
    println!("cargo:rerun-if-changed=app_build.rs");
    // `frontendDist` (../out) must exist for `generate_context!` — a plain
    // `cargo check` / `cargo test` (CI, no web build) gets an empty one.
    let _ = std::fs::create_dir_all("../out");
    app_build::run();
    tauri_build::build()
}
