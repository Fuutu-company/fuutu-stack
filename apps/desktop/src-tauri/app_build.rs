// App-owned — the kit never changes this file's content after release;
// fill it for your app.
//
// Your build-script steps, run by the kit's `build.rs` before
// `tauri_build::build()` — extra linker arguments, native libraries,
// generated code. Emit `cargo:` instructions with `println!`:
//
//     pub fn run() {
//         // Swift runtime of a macOS framework you link.
//         #[cfg(target_os = "macos")]
//         println!("cargo:rustc-link-arg=-Wl,-rpath,/usr/lib/swift");
//     }
//
// (`#[cfg(target_os)]` here is the build machine's OS; for cross builds
// read `std::env::var("CARGO_CFG_TARGET_OS")` instead.)

pub fn run() {}
