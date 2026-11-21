fn main() {
    // Desktop behaviour from desktopConfig (`apps/desktop/scripts/run.ts`
    // sets it); rebuild when it changes.
    println!("cargo:rerun-if-env-changed=FUUTU_DESKTOP_CONFIG");
    // `frontendDist` (../out) must exist for `generate_context!` — a plain
    // `cargo check` / `cargo test` (CI, no web build) gets an empty one.
    let _ = std::fs::create_dir_all("../out");
    tauri_build::build()
}
