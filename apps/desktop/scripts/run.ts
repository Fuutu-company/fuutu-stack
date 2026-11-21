/**
 * Desktop launcher behind `pnpm dev:desktop` / `pnpm build:desktop`
 * (entered through `tooling/scripts/desktop.mjs`, which already checked
 * `config.features.desktop` and the Rust toolchain).
 *
 * dev:   Next dev server on the slot's `desktop` port + `tauri dev` with the
 *        automation bridge (`devtools` feature) on the slot's
 *        `desktopBridge` port, token in `.fuutu/desktop-bridge.json`.
 * build: static export + `tauri build` (signing via env, see
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
import { buildTauriConfig, type TauriConfigMode } from "./lib/tauri-config";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(appDir, "../..");
const tauriDir = join(appDir, "src-tauri");

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

function writeTauriConfig(mode: TauriConfigMode, devUrl?: string): string {
	const file = join(tauriDir, `tauri.${mode}.generated.json`);
	writeFileSync(
		file,
		`${JSON.stringify(buildTauriConfig({ mode, appVersion: appVersion(), devUrl }), null, 2)}\n`,
	);
	return file;
}

function run(
	command: string,
	args: string[],
	env: NodeJS.ProcessEnv,
	cwd = appDir,
): ChildProcess {
	return spawn(command, args, { cwd, env, stdio: "inherit" });
}

function exitWith(child: ChildProcess, others: ChildProcess[] = []) {
	const stop = () => {
		for (const other of others) other.kill("SIGTERM");
	};
	child.on("exit", (code) => {
		stop();
		process.exit(code ?? 0);
	});
	for (const signal of ["SIGINT", "SIGTERM"] as const) {
		process.on(signal, () => {
			child.kill(signal);
			stop();
		});
	}
}

async function main() {
	const [mode, ...rest] = process.argv.slice(2) as [
		TauriConfigMode,
		...string[],
	];
	const project: Project = process.env.CI
		? describeProject(root, 0)
		: (readProject(root) ?? (await ensureSlot(root)));
	const env: NodeJS.ProcessEnv = {
		...readDotEnv(root),
		...process.env,
	};
	Object.assign(env, slotEnv(project, env));

	if (mode === "dev") {
		const port = project.ports.desktop;
		const devUrl = `http://localhost:${port}`;
		const config = writeTauriConfig("dev", devUrl);
		const web = run(
			"pnpm",
			["exec", "next", "dev", "--port", String(port)],
			env,
		);
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
		exitWith(tauri, [web]);
		return;
	}

	const config = writeTauriConfig("build");
	const web = run("pnpm", ["exec", "next", "build"], {
		...env,
		NODE_ENV: "production",
	});
	web.on("exit", (code) => {
		if (code !== 0) process.exit(code ?? 1);
		exitWith(
			run("pnpm", ["exec", "tauri", "build", "--config", config, ...rest], env),
		);
	});
}

await main();
