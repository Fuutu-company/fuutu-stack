# Vendored: `tauri-plugin-mcp-bridge` 0.13.2

Source: crates.io `tauri-plugin-mcp-bridge` 0.13.2 (2026-10-22),
<https://github.com/hypothesi/mcp-server-tauri>, MIT (see `LICENSE`, kept unchanged).

Used only by the desktop app's **debug** builds (`devtools` cargo feature +
`cfg(debug_assertions)`), so agents can drive the running app over MCP
(`check-in-desktop` skill). Never compiled into a release build
(`apps/desktop/scripts/check-release-clean.mjs`).

## Fuutu patch

Only `src/websocket.rs`, between the `Fuutu patch` markers and in
`handle_connection` (`accept_async` → `accept_hdr_async` with a check):

- the upgrade request must carry `x-fuutu-bridge-token` equal to
  `FUUTU_DESKTOP_BRIDGE_TOKEN` (constant-time compare; no token configured =
  every client refused);
- any `Origin` header is refused (browsers always send one — blocks web
  pages and DNS rebinding).

The kit always binds the bridge to `127.0.0.1` (upstream default: `0.0.0.0`).
Unit tests: `fuutu_auth_tests` in `src/websocket.rs`.

## Updating

Replace the directory with the new crate version from crates.io, re-apply
the patch, run `cargo test -p tauri-plugin-mcp-bridge`, bump the npm
`@hypothesi/tauri-mcp-server` devDependency to the same version.
Keep `rustfmt.toml` (`disable_all_formatting = true`): it keeps
`cargo fmt --all` from reformatting this vendored crate in apps' trees.
