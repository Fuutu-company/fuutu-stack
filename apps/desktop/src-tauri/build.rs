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
    link_clang_rt_on_macos();
    app_build::run();
    build_forward::import_app_ext_plugin_permissions();
    tauri_build::build()
}

/// macOS: link clang's runtime (`libclang_rt.osx.a`). Native code linked
/// into the app (Objective-C/C with `@available`, e.g. ggml's Metal backend
/// or your own `.m` files) calls `__isPlatformVersionAtLeast`. Rust's std
/// carries the symbol, but the release profile's fat LTO drops it because
/// no Rust code uses it, so only the release link fails. The archive is
/// static (no duplicate symbol when std's copy survives) and fat (covers
/// both slices of a universal build). All profiles, so debug and release
/// link the same way; a missing toolchain piece only warns.
fn link_clang_rt_on_macos() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("macos") {
        return;
    }
    // Switching Xcode (xcode-select or DEVELOPER_DIR) moves the runtime folder.
    println!("cargo:rerun-if-env-changed=DEVELOPER_DIR");
    let Ok(out) = std::process::Command::new("xcrun")
        .args(["clang", "-print-runtime-dir"])
        .output()
    else {
        println!(
            "cargo:warning=xcrun not found; a release link may miss __isPlatformVersionAtLeast"
        );
        return;
    };
    let dir = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if dir.is_empty()
        || !std::path::Path::new(&dir)
            .join("libclang_rt.osx.a")
            .is_file()
    {
        println!("cargo:warning=libclang_rt.osx.a not found; a release link may miss __isPlatformVersionAtLeast");
        return;
    }
    // Rerun when an Xcode update moves or removes the archive, so the cached
    // link-search path never points at a folder that is gone.
    println!("cargo:rerun-if-changed={dir}/libclang_rt.osx.a");
    println!("cargo:rustc-link-search=native={dir}");
    println!("cargo:rustc-link-lib=static=clang_rt.osx");
}
