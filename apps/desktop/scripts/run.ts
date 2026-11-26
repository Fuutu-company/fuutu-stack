/**
 * Desktop launcher behind `pnpm dev:desktop` / `pnpm build:desktop`
 * (entered through `tooling/scripts/desktop.mjs`, which already checked
 * `config.features.desktop` and the Rust toolchain).
 *
 * dev:   Next dev server on the slot's `desktop` port + `tauri dev` with the
 *        automation bridge (`devtools` feature) on the slot's
 *        `desktopBridge` port, token in `.fuutu/desktop-bridge.json`.
 * build: build telemetry ping (surface "desktop", fire-and-forget), static
 *        export, licence check, third-party notices, `tauri build` (code
 *        signing + updater signing via env, see apps/desktop/RELEASING.md).
 */
import { type ChildProcess, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { desktopConfig } from "@fuutu/desktop/config";
import {
	describeKitNameViolations,
	desktopIdentity,
	kitNameViolations,
} from "@fuutu/desktop/identity";
import {
	describeProject,
	ensureSlot,
	type Project,
	readDotEnv,
	readProject,
	slotEnv,
} from "../../../tooling/ports/index.mjs";
import {
	shellArgs,
	shellOption,
} from "../../../tooling/scripts/lib/spawn-shell.mjs";
import { APP_EXTERNAL_BIN } from "./lib/app-sidecars.mjs";
import { kitManifestGuard } from "./lib/kit-manifest";
import { linuxBundleArgs, linuxSelfUpdates } from "./lib/linux-release";
import {
	buildTauriConfig,
	type DesktopBuildInputs,
	desktopRuntimeConfig,
	ed25519Keys,
	NO_OFFLINE_KEYS_ENV,
	offlineKeyCheck,
	splitSigningEnv,
	type TauriConfigMode,
} from "./lib/tauri-config";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(appDir, "../..");
const tauriDir = join(appDir, "src-tauri");

// The Tauri CLI rewrites the kit Cargo.toml's tauri features from the
// config; put them back afterwards (scripts/lib/kit-manifest.ts).
const kitManifest = kitManifestGuard(tauriDir);
const guardKitManifest = () => kitManifest.guard();
const restoreKitManifest = () => kitManifest.restore();

const children = new Set<ChildProcess>();
let stopping = false;

/** Stops every child and exits with `code`. */
function shutdown(code: number): never {
	stopping = true;
	for (const child of children) child.kill("SIGTERM");
	restoreKitManifest();
	process.exit(code);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.on(signal, () => shutdown(0));
}

function run(
	command: string,
	args: string[],
	env: NodeJS.ProcessEnv,
): ChildProcess {
	const child = spawn(command, shellArgs(command, args), {
		cwd: appDir,
		env,
		stdio: "inherit",
		...shellOption(command),
	});
	children.add(child);
	child.on("exit", () => children.delete(child));
	return child;
}

/** Resolves with the exit code; never rejects. */
const exited = (child: ChildProcess) =>
	new Promise<number>((resolve) =>
		child.on("exit", (code) => resolve(code ?? 1)),
	);

/** Per-checkout bridge token (gitignored `.fuutu/`), created once. */
export function bridgeToken(): string {
	const file = join(root, ".fuutu/desktop-bridge.json");
	if (existsSync(file)) {
		const saved = JSON.parse(readFileSync(file, "utf8")) as { token?: string };
		if (saved.token) return saved.token;
	}
	const token = randomBytes(32).toString("base64url");
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, `${JSON.stringify({ token }, null, 2)}\n`, {
		mode: 0o600,
	});
	chmodSync(file, 0o600);
	return token;
}

function appVersion(): string {
	return (
		JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
			version: string;
		}
	).version;
}

function writeTauriConfig(
	mode: TauriConfigMode,
	inputs: DesktopBuildInputs,
	extra: {
		devUrl?: string;
		externalBin?: readonly string[];
		signUpdates?: boolean;
		windowsCertificateThumbprint?: string;
	} = {},
): string {
	const file = join(tauriDir, `tauri.${mode}.generated.json`);
	const config = buildTauriConfig({
		mode,
		appVersion: appVersion(),
		...inputs,
		...extra,
	});
	writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
	return file;
}

async function dev(
	project: Project,
	env: NodeJS.ProcessEnv,
	inputs: DesktopBuildInputs,
	rest: string[],
) {
	const port = project.ports.desktop;
	const config = writeTauriConfig("dev", inputs, {
		devUrl: `http://localhost:${port}`,
	});
	const web = run("pnpm", ["exec", "next", "dev", "--port", String(port)], env);
	guardKitManifest();
	const tauri = run(
		"pnpm",
		[
			"exec",
			"tauri",
			"dev",
			"--config",
			config,
			"--features",
			"devtools",
			...rest,
		],
		{
			...env,
			FUUTU_DESKTOP_BRIDGE_PORT: String(project.ports.desktopBridge),
			FUUTU_DESKTOP_BRIDGE_TOKEN: bridgeToken(),
			// Debug builds write the sign-in URL here (check-in-desktop skill).
			FUUTU_DESKTOP_SIGNIN_URL_FILE: join(root, ".fuutu/desktop-signin-url"),
		},
	);
	// Whichever dies first (port taken, window closed) ends the session.
	const code = await Promise.race([exited(web), exited(tauri)]);
	if (!stopping) shutdown(code);
}

async function build(
	env: NodeJS.ProcessEnv,
	inputs: DesktopBuildInputs,
	rest: string[],
) {
	const linux = process.platform === "linux";
	// Linux without an AppImage (desktopConfig.release.linuxFormats): the
	// packages update through the package manager, so no in-app updater.
	const signUpdates =
		Boolean(env.TAURI_SIGNING_PRIVATE_KEY) && !inputs.updatesViaPackage;
	const bundleArgs = linux
		? linuxBundleArgs(desktopConfig.release.linuxFormats, rest)
		: [];
	if (inputs.updatesViaPackage) {
		process.stderr.write(
			"note: no AppImage in desktopConfig.release.linuxFormats — Linux updates come through the package (no in-app updater)\n",
		);
	} else if (inputs.updaterPubkey && !signUpdates) {
		process.stderr.write(
			"DESKTOP_UPDATER_PUBLIC_KEY is set but TAURI_SIGNING_PRIVATE_KEY is not — updates would not verify. See apps/desktop/RELEASING.md\n",
		);
		shutdown(1);
	}
	if (!inputs.updaterPubkey && !inputs.updatesViaPackage) {
		process.stderr.write(
			"warning: no DESKTOP_UPDATER_PUBLIC_KEY — this build cannot update itself (apps/desktop/RELEASING.md)\n",
		);
	}
	const config = writeTauriConfig("build", inputs, {
		// Your bundled programs (app-owned scripts/lib/app-sidecars.mjs).
		externalBin: APP_EXTERNAL_BIN,
		signUpdates,
		windowsCertificateThumbprint:
			env.WINDOWS_CERTIFICATE_THUMBPRINT || undefined,
	});
	const node = process.execPath;
	// Build telemetry (LICENSE.md §7), surface "desktop" — fire-and-forget,
	// never blocks or fails the build; the ping script itself decides
	// whether to send (CI / production build, opt-out).
	// Signing secrets reach only `tauri build` — not the ping, `next build`
	// or the licence scripts (RELEASING.md → "Signing secrets").
	const { base, signing } = splitSigningEnv(env);
	const ping = spawn(node, [join(root, "packages/telemetry/bin/ping.mjs")], {
		env: { ...base, FUUTU_TELEMETRY_SURFACE: "desktop" },
		stdio: "ignore",
		detached: true,
	});
	ping.on("error", () => {});
	ping.unref();
	const steps: [string, string[], NodeJS.ProcessEnv][] = [
		["pnpm", ["exec", "next", "build"], base],
		// Licence gate + notices read the export's source maps …
		[node, ["scripts/licenses.mjs", "check"], base],
		[node, ["scripts/licenses.mjs", "notices"], base],
		// … which never ship.
		[node, ["scripts/strip-source-maps.mjs"], base],
		[
			"pnpm",
			["exec", "tauri", "build", "--config", config, ...bundleArgs, ...rest],
			{ ...base, ...signing },
		],
	];
	guardKitManifest();
	for (const [command, args, stepEnv] of steps) {
		const code = await exited(
			run(command, args, { ...stepEnv, NODE_ENV: "production" }),
		);
		if (code !== 0) shutdown(code);
	}
	shutdown(0);
}

/**
 * The backend's offline-claim keys, embedded into release builds — the
 * app trusts no other key (src-tauri/src/auth/offline.rs). None found
 * fails the build (`offlineKeyCheck`).
 */
async function offlineKeys(saasUrl: string | undefined): Promise<string[]> {
	if (desktopConfig.auth === "off" || !saasUrl) return [];
	try {
		const res = await fetch(new URL("/api/auth/jwks", saasUrl), {
			signal: AbortSignal.timeout(10_000),
		});
		return ed25519Keys(await res.json());
	} catch {
		return [];
	}
}

/** LICENSE.md §8 — release builds refuse the kit name, dev builds warn. */
function checkIdentity(mode: TauriConfigMode) {
	const violations = kitNameViolations(desktopIdentity, appVersion());
	if (violations.length === 0) return;
	const list = describeKitNameViolations(violations);
	if (mode === "build") {
		process.stderr.write(
			`\nRelease build refused (LICENSE.md §8): the app identity still carries the kit name.\n${list}\nSet config.app.name (packages/config/index.ts) or desktopConfig.identity — see apps/desktop/RELEASING.md.\n\n`,
		);
		process.exit(1);
	}
	process.stderr.write(
		`warning: the app identity still carries the kit name — fine for development, refused for release builds (LICENSE.md §8):\n${list}\n`,
	);
}

async function main() {
	const [mode, ...rest] = process.argv.slice(2) as [
		TauriConfigMode,
		...string[],
	];
	const project: Project = process.env.CI
		? describeProject(root, 0)
		: (readProject(root) ?? (await ensureSlot(root)));
	checkIdentity(mode);
	const env: NodeJS.ProcessEnv = { ...readDotEnv(root), ...process.env };
	Object.assign(env, slotEnv(project, env));
	const inputs: DesktopBuildInputs = {
		saasUrl: env.NEXT_PUBLIC_SAAS_URL,
		offlineKeys:
			mode === "build" ? await offlineKeys(env.NEXT_PUBLIC_SAAS_URL) : [],
		updaterPubkey: env.DESKTOP_UPDATER_PUBLIC_KEY || undefined,
		staticUpdateUrl: env.NEXT_PUBLIC_DESKTOP_UPDATE_URL || undefined,
		updatesViaPackage:
			mode === "build" &&
			process.platform === "linux" &&
			!linuxSelfUpdates(desktopConfig.release.linuxFormats),
		devSlot: mode === "dev" ? project.slot : undefined,
	};
	if (mode === "build") {
		const check = offlineKeyCheck({
			auth: desktopConfig.auth,
			graceDays: desktopConfig.offlineGraceDays,
			keys: inputs.offlineKeys ?? [],
			optOut: env[NO_OFFLINE_KEYS_ENV] === "1",
		});
		if (check.error) {
			process.stderr.write(`\nRelease build refused: ${check.error}\n\n`);
			process.exit(1);
		}
		if (check.graceDays !== desktopConfig.offlineGraceDays) {
			process.stderr.write(
				`warning: ${NO_OFFLINE_KEYS_ENV}=1 — this build has no offline grace\n`,
			);
		}
		inputs.offlineGraceDays = check.graceDays;
	}
	env.FUUTU_DESKTOP_CONFIG = JSON.stringify(desktopRuntimeConfig(inputs));
	if (mode === "dev") await dev(project, env, inputs, rest);
	else await build(env, inputs, rest);
}

await main();
