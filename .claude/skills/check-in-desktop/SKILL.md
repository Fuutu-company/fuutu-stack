---
name: check-in-desktop
description: Use after any change to the desktop app (apps/desktop — pages, components, Tauri config, Rust in src-tauri, desktop translations) or to saas code it calls — before calling desktop work done. Drives the real Tauri app over MCP.
metadata:
  fuutu-source: repo
  fuutu-category: workflow
---

# Check it in the real desktop app

Only when `config.features.desktop` is `true` (`packages/config/index.ts`). With the switch off there is no desktop app to check — say so and stop.

Green tests and a working web page do not prove the desktop app works: the static export, the Tauri asset protocol, capabilities, IPC and native windows only fail in the real app. Every manual check runs against the running Tauri app, driven over MCP — never "looked fine in the browser".

## The desktop session

- **Start it** (once per coding session, in the background): `pnpm dev:desktop`. It runs the Next dev server on the slot's `desktop` port and a **debug** Tauri build with the automation bridge on the slot's `desktopBridge` port (`pnpm ports`). First start compiles Rust (minutes); later starts take seconds. `pnpm dev:session status` shows whether the bridge is up.
- **The bridge** exists only in debug builds (`devtools` cargo feature + `cfg(debug_assertions)`), listens on 127.0.0.1 only and refuses clients without the per-checkout token (`.fuutu/desktop-bridge.json`) or with an `Origin` header. Never copy the token anywhere else.
- **Never stop** the app at the end — the developer reviews afterwards.

## Driving it

The `desktop` MCP server (`.mcp.json` → `tooling/scripts/desktop-mcp.mjs`) has the tools. Always start with `driver_session` `{ "action": "start", "port": <desktopBridge> }`, then:

| Need | Tool |
|---|---|
| Windows (list, focus, resize) | `manage_window` |
| What is on screen (roles, names, refs) | `webview_dom_snapshot` `{ "type": "accessibility" }` |
| Click / hover / scroll | `webview_interact` (CSS, XPath or `strategy: "text"`) |
| Type / keys | `webview_keyboard` |
| Wait for an element, text or IPC event | `webview_wait_for` |
| Screenshot (native capture) | `webview_screenshot` |
| Console + logs | `read_logs` `{ "source": "console" }` (`"system"` for the Rust side) |
| Run JS in the webview | `webview_execute_js` (IIFE returning JSON) |
| Call a Tauri command | `ipc_execute_command` (capabilities still apply) |
| Emit / observe events | `ipc_emit_event`, `ipc_monitor` + `ipc_get_captured` |

No `desktop` MCP tools in your session (server not loaded)? Use the same server from the shell — identical tools, images land in `.fuutu/desktop-shots/`:
`node tooling/scripts/desktop-mcp/call.mjs driver_session '{"action":"start","port":<desktopBridge>}' webview_screenshot '{}'`
(arguments are tool/JSON pairs; one process = one session, so put the whole sequence in one call).

## Signing in (auth `required` / `optional`)

The app signs in through the **system browser** — an agent cannot drive that. Start the session with `FUUTU_DESKTOP_SIGNIN_NO_BROWSER=1 pnpm dev:desktop` instead: debug builds then skip the system browser and write the authorization URL to `.fuutu/desktop-signin-url`. Click "Sign in" in the app, open that URL in your own `[qa] …` tab of the session browser (already signed in as `admin@fuutu.local`), click **Allow** on the consent page — the browser lands on the app's loopback page and the app is signed in. Debug builds keep tokens in `<app data dir>/dev-secrets.json` (0600) instead of the keychain, so rebuilds never raise keychain dialogs; `FUUTU_DESKTOP_KEYCHAIN=1` tests the real keychain. Signed out again: Account → Sign out.

## Steps

1. **List what to check** from the diff and the task's acceptance criteria: routes, windows (main, about), every locale in `i18nConfig.locales` (Settings → Language switches at runtime), light and dark theme, signed in / signed out per `desktopConfig.auth`.
2. **Make sure the app runs** (`pnpm dev:session status`); start `pnpm dev:desktop` in the background if the bridge is down.
   Then `pnpm -F @fuutu/desktop-app smoke` — bridge, Rust commands, shell, Settings, Account, page errors, screenshots `.fuutu/desktop-shots/smoke-*.png`. Green smoke first, then the task's own checks.
3. **Exercise each criterion** in the app: navigate, click the new control, submit, reload on a nested route (`location.reload()` via `webview_execute_js` — the static export must survive it).
4. **Read the console** after each step: zero errors **and** zero warnings. Each one gets a root-cause fix (`debug-root-cause`) — never filter it.
5. **Screenshot** every visual change and look at it.
6. Release-relevant changes (Cargo features, capabilities, the bridge): run `node apps/desktop/scripts/check-release-clean.mjs`.

## Updates

`DESKTOP_UPDATER_PUBLIC_KEY=<pub> pnpm dev:desktop` enables the updater in a debug build. Publish a higher version to the slot's MinIO bucket with `scripts/publish.ts` (signed with the matching test key, `tauri signer generate`/`sign`, keys in your scratchpad, never in git); the app offers it in the update dialog. Debug builds download and verify the update but never install it (they would replace `target/debug`). A window the OS reports as hidden pauses CSS animations: finish them (`document.getAnimations().forEach(a => a.finish())`) before a screenshot of an opening dialog.

## Report

Per check: window + route, state (locale, theme, signed in), result, console status, screenshot path. Example: `main /settings/account/ (de, dark, signed in) — renders after reload, console clean, .fuutu/desktop-shots/…png`.

## No bridge available?

(Rust missing, CI, another OS.) Say so plainly, list what to check, and ask the user to verify. Never report desktop work as verified without having driven the app.
