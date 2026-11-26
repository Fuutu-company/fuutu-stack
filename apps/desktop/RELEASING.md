# Releasing the desktop app

Signed installers for macOS (universal), Windows (x64) and Linux (x64),
in-app updates, and the download pages — all from one pipeline,
`.github/workflows/desktop.yml`. Nothing here runs while
`config.features.desktop` is `false`.

> [!IMPORTANT]
> **Your own name, or no release (LICENSE.md §8).** `pnpm build:desktop`
> and the generated Tauri config **refuse a release build** when
> "fuutu" (any case) appears in the product name, bundle id, deep-link
> scheme, OAuth client id, keychain service or user agent. Dev builds
> (`pnpm dev:desktop`) only warn, because the kit itself is named
> "Fuutu Stack". Set `config.app.name` (`packages/config/index.ts`), or
> `desktopConfig.identity` (`packages/desktop/src/config.ts`), to your
> product before your first release build. There is no opt-out.

## Version

The desktop app has **your app's version**: root `package.json#version`
(`APP_VERSION`), released as tag `vX.Y.Z`. Pushing that tag builds, signs
and publishes. A tag with a pre-release (`v2.0.0-beta.1`) publishes to the
`beta` channel, every other tag to `stable`. A manual run (Actions →
Desktop → Run workflow) picks the channel and whether to publish.

With `desktopConfig.access.perMajorVersion` on, a new **major** is a new
licence: the updater never offers `2.x` to an account licensed for `1.x`
(it stays on the newest `1.x`). See `packages/desktop/src/config.ts`.

## One-time setup

All keys go into GitHub **secrets** / **variables** (and your local
`.env` for builds by hand) — never into git.

### 1. Updater signing key (required for updates)

```bash
pnpm -F @fuutu/desktop-app exec tauri signer generate -w ~/.tauri/app-updater.key
```

| Where | Name | Value |
|---|---|---|
| secret | `TAURI_SIGNING_PRIVATE_KEY` | content of `app-updater.key` |
| secret | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | its password |
| variable | `DESKTOP_UPDATER_PUBLIC_KEY` | content of `app-updater.key.pub` |

Every build embeds the public key; the app installs only bundles signed
with the private key. **Losing the private key means installed apps can
never update again** — keep a backup outside GitHub. A build without
`DESKTOP_UPDATER_PUBLIC_KEY` has no updater at all.

### 2. macOS — Developer ID + notarisation

Needs an Apple Developer Program membership.

| Secret | Value |
|---|---|
| `APPLE_CERTIFICATE` | "Developer ID Application" certificate exported as `.p12`, base64 (`base64 -i cert.p12`) |
| `APPLE_CERTIFICATE_PASSWORD` | the `.p12` password |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Acme Inc (TEAMID)` |
| `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` | notarisation: Apple ID, an app-specific password, team id |

Tauri signs and notarises when these are set. Without them the build is
unsigned and Gatekeeper blocks it on other Macs.

### 3. Windows — Authenticode

| Secret | Value |
|---|---|
| `WINDOWS_CERTIFICATE` | code-signing certificate as `.pfx`, base64 |
| `WINDOWS_CERTIFICATE_PASSWORD` | its password |

CI imports it and signs through its thumbprint
(`WINDOWS_CERTIFICATE_THUMBPRINT`). An EV / cloud HSM certificate
(Azure Trusted Signing, …) cannot be exported as a `.pfx`: replace the
import step with your provider's signing action. Unsigned installers
trigger SmartScreen warnings.

### 4. Linux

No code signing. The formats come from `desktopConfig.release.linuxFormats`
(`packages/desktop/src/config.ts`, default `["appimage", "deb"]`):

- With `appimage`, the AppImage is the Linux download and updates itself,
  verified with the updater key.
- Without it (e.g. `["deb", "rpm"]`, when a bundled library's licence rules
  out an AppImage), every listed package is published as a download (the
  first one on the download page). Linux installs then update through the
  package manager: the build has no in-app updater, Settings → Updates says
  so, and the release has no Linux updater entry.

### 5. Releases bucket

Private bucket `desktopReleases` (`packages/storage/src/config.ts`,
physical name `S3_BUCKET_DESKTOP_RELEASES`, default `desktop-releases`).
Create it in your storage — the app never uploads to it, only CI does.

| Where | Name |
|---|---|
| secret | `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (write access to this bucket only) |
| variable | `S3_BUCKET_DESKTOP_RELEASES`, `S3_FORCE_PATH_STYLE` |
| variable | `NEXT_PUBLIC_SAAS_URL` — your production app URL (update endpoint + offline-claim keys) |

`apps/saas` needs read access to the same bucket (its normal `S3_*` env).
The publish script speaks S3 (AWS, R2, MinIO, …); with another storage
provider, replace `scripts/publish.ts`'s upload calls.

### 6. Protect the signing keys

Create the environment `desktop-release` (Settings → Environments) and
store every secret above **on it**, not as repository secrets:

- Required reviewers: someone must approve each release run.
- Deployment branches and tags: only tags `v*` (and `main` for manual runs).

The build and publish jobs of a release run inside it; pull-request builds
run outside it, unsigned, without any secret. Whoever can run code with
the updater key can ship an update every installed app accepts.

## Layout in the bucket

```
<channel>/<version>/<file>    installers + updater bundles
<channel>/latest.json         manifest — written last
```

`latest.json` is Tauri's static updater format plus `key` (object per
platform) and `downloads` (installer per download platform). See
`packages/desktop/src/updates.ts`.

## How updates reach the app

`desktopConfig.updates.source`:

- **`backend`** (default): the app asks
  `GET /api/desktop/updates/<target>/<arch>/<version>?channel=` with its
  access token. `apps/saas` checks sign-in, access and the licensed major,
  and answers `204` or the update with a **5-minute** download URL. The
  bucket stays private.
- **`static`**: for apps without a backend. The app reads a public
  manifest: set `NEXT_PUBLIC_DESKTOP_UPDATE_URL` at build time
  (`https://cdn.example.com/{channel}/latest.json`, `{channel}` is
  replaced) and the CI variable `DESKTOP_PUBLIC_BASE` (public URL of the
  bucket — the bucket, or a CDN in front of it, must be publicly readable).
  No licence check happens: anyone with the URL can download.

With auth `optional`, an app that sends an invalid or expired token
gets `401` (it refreshes and retries); without a token it gets updates
only up to the **lowest licensed major** (`desktopConfig.access.majors`;
the version in the URL does not raise that cap). Any newer major needs a
token. Only `desktopConfig.auth: "required"` actually protects the
binaries: with `optional` or `off`, anyone can download the installers of
the majors that need no licence.

Channels: `desktopConfig.updates.channels`; users pick one in Settings →
Updates.

## Downloads

- In the app: Settings → Desktop app (`/settings/desktop`) — buttons for
  the installers of the current `stable` release.
- Marketing: `/download` (only with the switch on). It reads
  `GET <saas>/api/desktop/download` for the current version.
- Downloads need a signed-in account (with auth `required`), not a plan:
  the app itself checks access at sign-in and on every session refresh.
- `GET /api/desktop/download/<macos|windows|linux>` redirects to a
  5-minute installer URL; with `desktopConfig.auth: "required"` only for a
  signed-in browser (others sign in first).

## Dev builds and worktrees

`pnpm dev:desktop` builds with the identifier `<bundleId>.dev.s<slot>`
(the checkout's port slot, `pnpm ports`); release builds and CI keep the
bundle id. So:

- Worktrees run side by side: single-instance locks per identifier, and
  a second checkout's dev app no longer hands over to the first and exits.
- Each slot has its own app data folder (dev sign-in, `dev-secrets.json`,
  window state, your app's data under `app_data_dir`), and dev never
  touches the installed app's. Sign in once per worktree.
- On Linux and Windows the deep-link fallback (`<scheme>://…`) reaches
  the dev app started last; sign-in normally uses the loopback redirect.
- Data your app keeps under `app_data_dir` is per slot in dev. Keep large
  downloads (e.g. models) in a fixed folder instead, so every worktree
  finds them.

## Building by hand

```bash
pnpm build:desktop                       # this machine's platform
pnpm build:desktop --target universal-apple-darwin
```

It sends one build telemetry ping with surface `desktop`
(LICENSE.md §7). Signing keys come from your `.env`.

### Signing secrets

`TAURI_SIGNING_*`, `APPLE_*` and `WINDOWS_CERTIFICATE*` reach **only**
`tauri build`. `pnpm build:desktop` strips them from the telemetry ping,
`next build` and the licence scripts (`splitSigningEnv`,
`scripts/lib/tauri-config.ts`). In CI only the Build step gets them, and
every action in the workflow is pinned by commit SHA. Bump a SHA together
with its `# vX` comment.

### Offline keys (release builds)

With sign-in on (`auth` not `off`) and offline grace
(`desktopConfig.offlineGraceDays` > 0), a release build fetches the
backend's Ed25519 keys from `NEXT_PUBLIC_SAAS_URL/api/auth/jwks` and
embeds them. A release build **fails** when it gets no key, so run it
against your running production app. The app trusts only these embedded
keys, never a key stored next to the claim. Debug builds also accept the
key of the last online session.

To ship without offline grace on purpose, set
`DESKTOP_ALLOW_NO_OFFLINE_KEYS=1`. The build then sets `graceDays` to 0,
so the app needs the backend at every start.

Offline claims are bound to the device and the account:

- **Device:** each install generates an Ed25519 key pair in the OS
  keychain. The backend signs its public key into the claim (`cnf`), so a
  claim copied to another install grants nothing.
- **Account:** offline mode needs a stored refresh token, and the claim's
  `sub` must match the cached account.
- **Clock:** the rollback marker (last seen time) is stored separately
  from the claim.

Publish build outputs (one directory per job — `macos-universal`,
`windows-x86_64`, `linux-x86_64` — each holding a `bundle/` output):

```bash
pnpm -F @fuutu/desktop-app exec tsx scripts/publish.ts --dir ./release --channel stable --dry-run
```

`--dry-run` prints the plan and the manifest without uploading.

## Extend without forking

Build your product through the app-owned files below, never by editing
kit files. A kit update leaves their content alone. Each one ships empty
(or as identity), and kit tests never check what you put in them.

**UI** (`src/`). Your pages are new route files,
`src/app/(main)/<route>/page.tsx`, inside the shell and the access gate.
The kit owns only home, settings and about. Pages without the shell and
another start route: [Full-window routes and start route](#full-window-routes-and-start-route).

| File | What it adds |
|---|---|
| `src/app-nav.ts` | `appNavItems`: sidebar items (`titleKey` under `desktop.shell.nav`, `href`, `icon`, `after`). Labels go in the `desktop` section of `packages/i18n/translations/<locale>/app/index.ts`. With `desktopConfig.auth: "off"` the sidebar has no Account item, so items with `after: "account"` are appended. |
| `src/app-home.tsx` | `appHome`: the home page content |
| `src/app-about.tsx` | `appAboutSection`: a section of the About window, above the notices |
| `src/app-shell-slot.tsx` | `appShellSlots`: `sidebarTop`, `sidebarBottom`, `contentTop`, `global` (dialogs, listeners) |
| `src/app-setup-steps.tsx` | `appSetupSteps`: first-run steps, once per device. `pre-auth` steps (e.g. language) run in front of the sign-in card and never reach the app. `post-auth` steps run after sign-in (or when no sign-in is needed), before the shell. Each one calls `onDone()`. |

**Tauri and the build** (`scripts/lib/`):

| File | What it adds |
|---|---|
| `scripts/lib/app-capabilities.ts` | `APP_CAPABILITIES`: Tauri capabilities (inline, or the identifier of a file in `src-tauri/capabilities/`), added after the kit's `default` in dev and release builds. It may not contain the devtools capability or the bridge. |
| `scripts/lib/app-tauri-config.ts` | `APP_TAURI_CONFIG`: Tauri config keys deep-merged into the generated config (objects merge, arrays replace), e.g. `app.macOSPrivateApi` or `bundle.macOS.minimumSystemVersion`. `bundle.macOS.infoPlist` is the **path** of a plist merged into Info.plist (e.g. `src-tauri/Info.plist` with `NSMicrophoneUsageDescription`). Translated prompts go in `src-tauri/macos/<locale>.lproj/InfoPlist.strings`, listed with `files: localizedInfoPlistFiles([...])` (`renderInfoPlistStrings` writes one). The build **refuses** identity, `build`, `app.security` (CSP, capabilities), `app.withGlobalTauri`, updater and deep-link plugins, updater artifacts, `externalBin` and signing keys, and the `main` window must stay. |
| `scripts/lib/app-sidecars.mjs` | `APP_EXTERNAL_BIN`: sidecar programs for `bundle.externalBin` (release builds only)<br>`shippedSidecars()`: their `name`, `version`, `license` and `text` for About → Licences and the licence gate (same allowlist as npm; a missing field fails the build)<br>Optional `build({ target })`: CI runs it per build job ("Build sidecars", no secrets). Output goes to `src-tauri/<path>-<target>`, and `binaries/` is git-ignored. |
| `scripts/lib/app-ci.mjs` | Inputs of `.github/workflows/desktop.yml`, so you never edit the workflow: `LINUX_RUNNER` (runner image of the Rust checks and the Linux build, default `ubuntu-22.04`) and `LINUX_APT_PACKAGES` (extra apt packages for both Linux jobs). Read and validated by `scripts/ci-inputs.mjs` in the gate job. |

**Rust** (`src-tauri/`):

| File | What it adds |
|---|---|
| `src-tauri/app-ext/Cargo.toml`, `src-tauri/app-ext/src/lib.rs`, `src-tauri/app-ext/build.rs` | `app-ext`: your Rust dependencies and code. The kit crate depends on it, so you never edit the kit's `Cargo.toml`. Keep the package name, `links = "app-ext"` and the forwarding call in `build.rs`; more crates go in `crates/`. |
| `src-tauri/src/app_plugins.rs` | `register(builder, &RuntimeConfig)`: your Tauri plugins. `lib.rs` calls it once, after the kit's plugins, with the runtime config (`saas_url`, `identity`, …). `tray_items(app, &RuntimeConfig)`: your tray menu entries (`TrayItem::new(id, label)`, `.disabled()`), shown between the kit's "Show" and "Quit" and rebuilt with the menu (start, UI language change). `on_tray_menu(app, id)`: clicks on them. The ids `show` and `quit` are the kit's; a reserved, empty or duplicate id is skipped and logged. |
| `src-tauri/app_build.rs` | `run()`: build-script steps (e.g. `cargo:rustc-link-arg=-Wl,-rpath,/usr/lib/swift`), called by the kit's `build.rs` |
| `src-tauri/deny.app.toml` | cargo-deny exceptions (`[[licenses.exceptions]]`, `[[advisories.ignore]]`, `[[bans.skip]]`), appended to the kit policy by `node scripts/cargo-deny.mjs` (CI runs it). The policy itself stays the kit's. Locally, install cargo-deny first (`cargo install cargo-deny --locked`); the script calls `cargo deny`. |

Register every plugin on the builder in `register`. Never register a
plugin from inside another plugin's `setup`, because that deadlocks the
app at startup.

**Tauri plugins in app-ext.** Add the plugin to `app-ext/Cargo.toml`, register it in
`app_plugins.rs` and list its permissions (`<plugin>:allow-…`) in
`app-capabilities.ts`. tauri-build reads plugin permissions only from
direct dependencies of the app crate. `app-ext/build.rs` re-exports them
under `links = "app-ext"`, and the kit `build.rs` restores the original
names (`src-tauri/build_forward.rs`).

**Your own commands.** `lib.rs` owns the app's only `invoke_handler`; a
handler you set on the builder in `app_plugins::register` is silently
replaced by the kit's. Ship your commands as a plugin instead: a crate
under `crates/<name>/` (`links = "tauri-plugin-<name>"`, `tauri-plugin`
with the `build` feature as build-dependency, a `build.rs` with
`tauri_plugin::Builder::new(&["my_cmd"]).build()`), depended on from
`app-ext/Cargo.toml`. Its `init()` returns
`tauri::plugin::Builder::new("<name>").invoke_handler(tauri::generate_handler![my_cmd]).build()`,
registered in `register`. The webview calls `invoke("plugin:<name>|my_cmd")`.
The plugin's `build.rs` generates the permissions `<name>:allow-<cmd>`
(underscores become hyphens; no `default` permission unless you write
`permissions/default.toml`), and `app-ext/build.rs` forwards them like any
plugin's (without `links` and that build script there is nothing to
forward; `src-tauri/crates/README.md`); grant them in `app-capabilities.ts`. Plugin commands are always
checked against the capabilities, so a command without a granted
permission is refused. `tauri::ipc::Channel` arguments work unchanged.

**Tauri features in the kit Cargo.toml.** `tauri dev` / `tauri build`
rewrite the kit `Cargo.toml`'s `tauri` features to match the config
(`app.macOSPrivateApi` → `macos-private-api`, also `protocol-asset`,
`isolation`). `pnpm dev:desktop` / `pnpm build:desktop` put the file back
when the CLI exits, and at the next start after a crash
(`scripts/lib/kit-manifest.ts`). Only that rewrite is reverted. CI fails
when a build leaves the file changed ("Kit Cargo.toml unchanged"). If your
own code in app-ext calls such APIs, declare the feature on app-ext's
`tauri` dependency; plain `cargo check` then compiles them too.

**Generated files in your folders.** Files your tools generate (e.g.
TypeScript bindings of your Rust commands) do not have to pass Biome. Put
a nested `biome.json` in that folder instead of editing the root one:

```json
{
	"root": false,
	"extends": "//",
	"files": { "includes": ["!**/*.ts"] }
}
```

`"extends": "//"` keeps the root config for everything else in the folder;
the pattern excludes the generated `.ts` files only.

### Full-window routes and start route

A page without the sidebar and header (an editor, a reader, a game view)
lives in your own route group next to the kit's `(main)`:
`src/app/(<group>)/layout.tsx` with `src/app/(<group>)/<route>/page.tsx`.
`(main)/layout.tsx` stays the kit's. Your layout must keep the account,
the access gate and the update dialog, or the route opens without sign-in
or plan checks:

```tsx
import type { PropsWithChildren } from "react";
import { AccessGate, AccessNotice } from "@/components/access-gate";
import { AccountProvider } from "@/components/account-provider";
import { UpdateDialog } from "@/components/update-dialog";

export default function FullWindowLayout({ children }: PropsWithChildren) {
	return (
		<AccountProvider>
			<AccessGate>
				<AccessNotice />
				{children}
				<UpdateDialog />
			</AccessGate>
		</AccountProvider>
	);
}
```

`AccessNotice` (offline grace, trial end) sits in the kit shell's content
column; outside the shell you place it yourself. Route paths must not
collide with the kit's (`/`, `/settings/…`, `/about/`).

The window opens on `/` (home). To start on another route, set the `main`
window's `url` in `APP_TAURI_CONFIG`. Arrays replace the kit's, so repeat
the whole window: the label `main`, the title and the kit's sizes, plus
anything else you set (e.g. `visible`). The `url` is relative to the app
and keeps the trailing slash (the static export writes `<route>/index.html`):

```ts
import { desktopIdentity } from "@fuutu/desktop/identity";

export const APP_TAURI_CONFIG: AppTauriConfig = {
	app: {
		windows: [
			{
				label: "main",
				title: desktopIdentity.productName,
				width: 1100,
				height: 720,
				minWidth: 800,
				minHeight: 480,
				url: "editor/",
			},
		],
	},
};
```

#### Own stylesheet on full-window routes

A stylesheet your route group's layout imports stays loaded after a
client navigation away from the group, so unscoped rules would leak into
the kit's pages. Scope everything under a root class your layout sets on
`<html>` while the route is open (and removes on unmount), with
`:where(html.<app>)` so the scope adds no specificity. Reference
Tailwind's default theme (spacing, type scale, colors, breakpoints) and
the kit's tokens (`bg-primary`, `text-foreground`); a reference emits no
preflight and no `:root` variables. Then generate the utilities inside
the scope, from your folder only:

```css
/* src/app/(editor)/editor.css, imported by (editor)/layout.tsx */
@reference "tailwindcss/theme.css";
@reference "@fuutu/config/theme.css";
/* Only if you use its classes (animate-in, fade-in, …): */
@reference "tw-animate-css";
/* @reference also brings the kit theme's @source lines; drop them here. */
@source not "../../../../../packages/ui/src";
@source not "../../../../../packages/mail/src";
@source not "../../../../../packages/analytics/src";

:where(html.editor) {
	@tailwind utilities source("../../editor");
}
```

Reference `@fuutu/config/theme.css`, not `../globals.css`: a referenced
file brings its `@source` lines along, and the `@source not` for your
folder in `globals.css` (below) would then drop your own classes. Without
the three `@source not` lines the stylesheet repeats the kit's utilities
for the shared packages under your scope. Keep one `@source not` per
`@source` in `packages/config/theme.css`, and re-check that list after a
kit update. (`@source` paths are relative to the file they are in.)

Keep the code that uses these classes in that folder (`src/editor/`).
The layout sets the class:

```tsx
useEffect(() => {
	document.documentElement.classList.add("editor");
	return () => document.documentElement.classList.remove("editor");
}, []);
```

Utilities come out as `:where(html.editor) .flex { … }`. So the kit's
Tailwind does not also emit them unscoped, append your folder to the
kit's `src/app/globals.css` (appending to this kit file is fine):

```css
@source not "../editor";
```

**Theme values and your own tokens.** The kit build writes a theme
variable (`--radius-md`, `--ease-in`, …) only when it sees it used, and
your folder is excluded from it, so `var(--radius-md)` in your CSS or
`max-w-[var(--container-xl)]` in a class can resolve to nothing, without
an error. In your CSS write `--theme(--radius-md)` (→
`calc(var(--radius) - 2px)`) or `--theme(--ease-in inline)` (→ the
literal value); in class names use the named utilities (`rounded-md`,
`max-w-xl`). A variable that must exist at runtime is declared under
the scope (`:where(html.editor) { --editor-gutter: 2rem; }`). Your own
tokens go in `@theme inline { … }` after the `@reference` lines, so
utilities such as `bg-paper` get the literal value; a plain `@theme`
makes them read variables nothing defines (and Biome 2.5 does not parse
`@theme inline reference`). Keeping the tokens in a separate file you
`@reference "./theme.css"` works too, but is not required:

```css
@theme inline {
	--color-paper: #f5ecd7;
}

:where(html.editor) {
	@tailwind utilities source("../../editor");
	.page {
		border-radius: --theme(--radius-md);
		transition-timing-function: --theme(--ease-in inline);
	}
}
```

### Local media

The asset protocol (`convertFileSrc`, `app.security.assetProtocol`) and an
app CSP are refused on purpose: an asset scope exposes that file tree to
any script that runs in the webview, injected script included. Hand files
to the webview as bytes instead:

- **Images**: a command returns `tauri::ipc::Response::new(bytes)`; the
  webview gets an `ArrayBuffer`, wraps it in a `Blob` with the right type
  and shows `URL.createObjectURL(blob)` (revoke it when the image goes).
  The release CSP allows `img-src 'self' data: blob: https:`.
- **Audio**: the release CSP has no `media-src`, so `default-src 'self'`
  blocks `<audio src="blob:…">`. Decode the IPC bytes with Web Audio
  (`AudioContext.decodeAudioData(buffer)`, played through an
  `AudioBufferSourceNode`), or play the sound natively in Rust.

Dev builds run with `csp: null`, so a URL the release CSP blocks works in
`pnpm dev:desktop` and breaks only in a release build. Check media in a
release build before you ship.

### Window state and a launch without a white flash

The kit's window-state plugin saves and restores size, position,
maximized, fullscreen and decorations of every window but About. It never
restores visibility: restoring it would call `show()` on every start.

The webview paints white until the first frame of your page. To open the
window only once its page has loaded:

1. Set `visible: false` on the `main` window in `APP_TAURI_CONFIG`
   (repeat the whole window, see above). Optional: `backgroundColor`
   (e.g. `"#1c1917"`), so the window and webview start in your background
   color.
2. Show the window from Rust when the page has loaded. The first frame
   is the kit's loading screen (the access gate while the account
   loads), so this fits apps that keep the kit's look. It works with the
   kit's `(main)` layout and `auth: "required"` and needs no capability.
   A plugin without commands needs no crate or build script of its own:
   put it in `app_plugins.rs` and add it in `register`
   (`builder.plugin(show_main_on_load())`):

   ```rust
   use tauri::{plugin::{Builder, TauriPlugin}, webview::PageLoadEvent, Runtime};

   pub fn show_main_on_load<R: Runtime>() -> TauriPlugin<R> {
       Builder::new("show-main")
           .on_page_load(|webview, payload| {
               if payload.event() == PageLoadEvent::Finished && webview.label() == "main" {
                   let _ = webview.window().show();
               }
           })
           .build()
   }
   ```

   Or show it from the webview once the account is known, so the first
   frame is already the sign-in card or your page: grant
   `core:window:allow-show` to the `main` window in `app-capabilities.ts`
   and render this component in your own route group's layout, inside
   `AccountProvider` and outside `AccessGate`:

   ```tsx
   function ShowWindowWhenReady() {
   	const { decision } = useAccount();
   	useEffect(() => {
   		if (decision !== undefined) void getCurrentWindow().show();
   	}, [decision]);
   	return null;
   }
   ```

   (`useAccount` from `@/components/account-provider`, `getCurrentWindow`
   from `@tauri-apps/api/window`.) Call `show()` directly, never inside
   `requestAnimationFrame`: WebKit may pause animation frames of a page
   that was never shown, so the window would stay hidden. The kit's
   `(main)` layout has no slot outside the access gate
   (`appShellSlots.global` renders only once the gate opens and the setup
   steps are done), so this variant needs your own route group.

With `desktopConfig.shell.singleInstance` or `shell.tray` on, a second
launch or the tray's "Show" also shows the window.

## Before the first release

- [ ] `config.features.desktop: true`, `desktopConfig` reviewed
      (`packages/desktop/src/config.ts`): auth mode, `access`, device limit,
      trial, update source and channels.
- [ ] Identity: `config.app` name / `desktopConfig.identity` give your
      own product name, bundle id and deep-link scheme — never "Fuutu"
      (LICENSE.md §8). The bundle id can never change after the first release.
- [ ] Icons made from your logo: `pnpm assets:sync` renders `logo.svg` on
      the sign-in backdrop (light area colors from `brand.css`) into
      `src-tauri/icons`. Own artwork: `pnpm assets:sync --skip=app-icon.png`,
      then `pnpm -F @fuutu/desktop-app exec tauri icon <1024px.png>`.
- [ ] Updater key pair created, private key backed up outside GitHub (§1).
- [ ] macOS Developer ID + notarisation secrets set (§2); a release build
      opens on a second Mac without a Gatekeeper warning.
- [ ] Windows certificate set (§3); the installer shows your publisher name.
- [ ] Environment `desktop-release` protected with reviewers and tag rules (§6).
- [ ] Releases bucket created, private; CI credentials write-only to it;
      `apps/saas` can read it (§5).
- [ ] `NEXT_PUBLIC_SAAS_URL` points at production. The build embeds its
      offline keys; it fails without them unless you set
      `DESKTOP_ALLOW_NO_OFFLINE_KEYS=1`, which ships with no offline grace.
- [ ] API: desktop tokens reach only procedures marked `desktopAllowed`
      (`.use(desktopAllowed)` or `authProcedure({ desktopAllowed: true })`).
      Mark the procedures your desktop pages call. A token stays pinned to
      the org that was active at sign-in. Other org-scoped calls only work
      in that org, so to work in another org, sign in again with it active. To gate API use by plan,
      set `apiConfig.apiKeyScopeFeatures.desktop`.
- [ ] One full round on a test channel: install `vX.Y.Z-beta.1`, publish
      `-beta.2`, the app offers it, installs it and restarts.
- [ ] `/download` (marketing) and Settings → Desktop app list your installers.
- [ ] Third-party notices (About → Licences) complete; `node apps/desktop/scripts/cargo-deny.mjs` green
      (needs `cargo install cargo-deny --locked`).
- [ ] Build telemetry stays on (LICENSE.md §7) — never set
      `FUUTU_TELEMETRY_DISABLED` in the release workflow.
