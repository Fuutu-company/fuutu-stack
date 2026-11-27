# Product crates

Put your own Rust crates here (`crates/<name>/Cargo.toml`); they join the
workspace automatically (`members = ["crates/*"]`). Depend on them from
the app-owned `../app-ext/Cargo.toml` (`<name> = { path = "../crates/<name>" }`),
never from the kit's `../Cargo.toml`.

A Tauri plugin crate (e.g. your own commands, see `../../RELEASING.md`,
"Your own commands") needs `links = "tauri-plugin-<name>"` in its
`[package]` and a build script from `tauri-plugin` (build-dependency with
the `build` feature):

```rust
// crates/<name>/build.rs
const COMMANDS: &[&str] = &["my_cmd"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
```

If one is missing:

- no build script: no permissions are generated, `app-ext/build.rs` has
  nothing to forward, and the commands are refused at runtime;
- a build script without `links`: the build fails (`LinksMissing`);
- `links` without a build script: cargo refuses the crate.
