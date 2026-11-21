// App-owned — the kit never changes this file's content after release;
// fill it for your app.
//
// Build script of your `app-ext` crate. Keep the forwarding call: it hands
// the permissions of the Tauri plugins you depend on here to the app
// (tauri-build reads them only from direct dependencies). Add your own
// steps after it.

#[path = "../build_forward.rs"]
mod build_forward;

fn main() {
    build_forward::reexport_plugin_permissions();
}
