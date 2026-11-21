/**
 * Desktop launcher behind `pnpm dev:desktop` / `pnpm build:desktop`
 * (entered through `tooling/scripts/desktop.mjs`, which already checked
 * `config.features.desktop` and the Rust toolchain).
 *
 * dev:   Next dev server on the slot's `desktop` port + `tauri dev` with the
 *        automation bridge (`devtools` feature) on the slot's
 *        `desktopBridge` port, token in `.fuutu/desktop-bridge.json`.
 * build: build telemetry ping (fire-and-forget), licence check, third-party
 *        notices, static export, `tauri build` (signing via env, see
 *        apps/desktop/RELEASING.md).
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
import {
	describeProject,
	ensureSlot,
	type Project,
	readDotEnv,
	readProject,
	slotEnv,
} from "../../../tooling/ports/index.mjs";
import {
	buildTauriConfig,
	desktopRuntimeConfig,
	type TauriConfigMode,
} from "./lib/tauri-config";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(appDir, "../..");
const tauriDir = join(appDir, "src-tauri");

const children = new Set<ChildProcess>();
let stopping = false;

/** Stops every child and exits with `code`. */
function shutdown(code: number): never {
	stopping = true;
	for (const child of children) child.kill("SIGTERM");
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
	const child = spawn(command, args, { cwd: appDir, env, stdio: "inherit" });
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
	saasUrl: string | undefined,
	devUrl?: string,
): string {
	const file = join(tauriDir, `tauri.${mode}.generated.json`);
	const config = buildTauriConfig({
		mode,
		appVersion: appVersion(),
		devUrl,
		saasUrl,
	});
	writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
	return file;
}

async function dev(project: Project, env: NodeJS.ProcessEnv, rest: string[]) {
	const port = project.ports.desktop;
	const config = writeTauriConfig(
		"dev",
		env.NEXT_PUBLIC_SAAS_URL,
		`http://localhost:${port}`,
	);
	const web = run("pnpm", ["exec", "next", "dev", "--port", String(port)], env);
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
		},
	);
	// Whichever dies first (port taken, window closed) ends the session.
	const code = await Promise.race([exited(web), exited(tauri)]);
	if (!stopping) shutdown(code);
}

async function build(env: NodeJS.ProcessEnv, rest: string[]) {
	const config = writeTauriConfig("build", env.NEXT_PUBLIC_SAAS_URL);
	const node = process.execPath;
	const steps: [string, string[]][] = [
		["pnpm", ["exec", "next", "build"]],
		// Licence gate + notices read the export's source maps …
		[node, ["scripts/licenses.mjs", "check"]],
		[node, ["scripts/licenses.mjs", "notices"]],
		// … which never ship.
		[node, ["scripts/strip-source-maps.mjs"]],
		["pnpm", ["exec", "tauri", "build", "--config", config, ...rest]],
	];
	for (const [command, args] of steps) {
		const code = await exited(
			run(command, args, { ...env, NODE_ENV: "production" }),
		);
		if (code !== 0) shutdown(code);
	}
	shutdown(0);
}

async function main() {
	const [mode, ...rest] = process.argv.slice(2) as [
		TauriConfigMode,
		...string[],
	];
	const project: Project = process.env.CI
		? describeProject(root, 0)
		: (readProject(root) ?? (await ensureSlot(root)));
	const env: NodeJS.ProcessEnv = { ...readDotEnv(root), ...process.env };
	Object.assign(env, slotEnv(project, env));
	env.FUUTU_DESKTOP_CONFIG = JSON.stringify(
		desktopRuntimeConfig(env.NEXT_PUBLIC_SAAS_URL),
	);
	if (mode === "dev") await dev(project, env, rest);
	else await build(env, rest);
}

await main();
