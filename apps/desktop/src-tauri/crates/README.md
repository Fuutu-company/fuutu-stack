# Product crates

Put your own Rust crates here (`crates/<name>/Cargo.toml`); they join the
workspace automatically (`members = ["crates/*"]`). Depend on them from
the app-owned `../app-ext/Cargo.toml` (`<name> = { path = "../crates/<name>" }`),
never from the kit's `../Cargo.toml`.
