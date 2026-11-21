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

No code signing. AppImage updates are verified with the updater key; the
`.deb` is offered as a download only.

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
The kit owns only home, settings and about.

| File | What it adds |
|---|---|
| `src/app-nav.ts` | `appNavItems`: sidebar items (`titleKey` under `desktop.shell.nav`, `href`, `icon`, `after`). Labels go in the `desktop` section of `packages/i18n/translations/<locale>/app/index.ts`. |
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

**Rust** (`src-tauri/`):

| File | What it adds |
|---|---|
| `src-tauri/app-ext/Cargo.toml`, `src-tauri/app-ext/src/lib.rs`, `src-tauri/app-ext/build.rs` | `app-ext`: your Rust dependencies and code. The kit crate depends on it, so you never edit the kit's `Cargo.toml`. Keep the package name, `links = "app-ext"` and the forwarding call in `build.rs`; more crates go in `crates/`. |
| `src-tauri/src/app_plugins.rs` | `register(builder, &RuntimeConfig)`: your Tauri plugins. `lib.rs` calls it once, after the kit's plugins, with the runtime config (`saas_url`, `identity`, …). `tray_items(app, &RuntimeConfig)`: your tray menu entries (`TrayItem::new(id, label)`, `.disabled()`), shown between the kit's "Show" and "Quit" and rebuilt with the menu (start, UI language change). `on_tray_menu(app, id)`: clicks on them. The ids `show` and `quit` are the kit's; a reserved, empty or duplicate id is skipped and logged. |
| `src-tauri/app_build.rs` | `run()`: build-script steps (e.g. `cargo:rustc-link-arg=-Wl,-rpath,/usr/lib/swift`), called by the kit's `build.rs` |
| `src-tauri/deny.app.toml` | cargo-deny exceptions (`[[licenses.exceptions]]`, `[[advisories.ignore]]`, `[[bans.skip]]`), appended to the kit policy by `node scripts/cargo-deny.mjs` (CI runs it). The policy itself stays the kit's. |

Register every plugin on the builder in `register`. Never register a
plugin from inside another plugin's `setup`, because that deadlocks the
app at startup.

**Tauri plugins in app-ext.** Add the plugin to `app-ext/Cargo.toml`, register it in
`app_plugins.rs` and list its permissions (`<plugin>:allow-…`) in
`app-capabilities.ts`. tauri-build reads plugin permissions only from
direct dependencies of the app crate. `app-ext/build.rs` re-exports them
under `links = "app-ext"`, and the kit `build.rs` restores the original
names (`src-tauri/build_forward.rs`).

**Tauri features in the kit Cargo.toml.** `tauri dev` / `tauri build`
rewrite the kit `Cargo.toml`'s `tauri` features to match the config
(`app.macOSPrivateApi` → `macos-private-api`, also `protocol-asset`,
`isolation`). `pnpm dev:desktop` / `pnpm build:desktop` put the file back
when the CLI exits, and at the next start after a crash
(`scripts/lib/kit-manifest.ts`). Only that rewrite is reverted. CI fails
when a build leaves the file changed ("Kit Cargo.toml unchanged"). If your
own code in app-ext calls such APIs, declare the feature on app-ext's
`tauri` dependency; plain `cargo check` then compiles them too.

## Before the first release

- [ ] `config.features.desktop: true`, `desktopConfig` reviewed
      (`packages/desktop/src/config.ts`): auth mode, `access`, device limit,
      trial, update source and channels.
- [ ] Identity: `config.app` name / `desktopConfig.identity` give your
      own product name, bundle id and deep-link scheme — never "Fuutu"
      (LICENSE.md §8). The bundle id can never change after the first release.
- [ ] Icons replaced: `pnpm -F @fuutu/desktop-app exec tauri icon <1024px.png>`.
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
- [ ] Third-party notices (About → Licences) complete; `node apps/desktop/scripts/cargo-deny.mjs` green.
- [ ] Build telemetry stays on (LICENSE.md §7) — never set
      `FUUTU_TELEMETRY_DISABLED` in the release workflow.
