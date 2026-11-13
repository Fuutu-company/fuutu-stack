#!/usr/bin/env node
/**
 * Starts a Next.js app on its port-slot port with the slot's local URLs,
 * database and auth cookie prefix (tooling/ports). Every app's `dev` and
 * `start` script goes through here, so no port is hard-coded anywhere.
 *
 *   node ../../tooling/scripts/next.mjs dev saas
 *   node ../../tooling/scripts/next.mjs start marketing
 *   node ../../tooling/scripts/next.mjs e2e saas   # build + start on the E2E port
 *
 * In CI there is no registry: slot 0 (the classic ports).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	describeProject,
	ensureSlot,
	findRoot,
	isE2eResetTarget,
	readProject,
	slotEnv,
} from "../ports/index.mjs";

const APP_PORT = {
	saas: "saas",
	marketing: "marketing",
	docs: "docs",
	"mail-preview": "mailPreview",
};
const E2E_PORT = { saas: "e2eSaas", marketing: "e2eMarketing" };

const [mode, app, ...rest] = process.argv.slice(2);
if (!["dev", "start", "e2e"].includes(mode) || !APP_PORT[app]) {
	process.stderr.write(
		"usage: next.mjs <dev|start|e2e> <saas|marketing|docs|mail-preview> [next args]\n",
	);
	process.exit(1);
}
if (mode === "e2e" && !E2E_PORT[app]) {
	process.stderr.write(`no E2E port for ${app}\n`);
	process.exit(1);
}

const root = findRoot();
const project = process.env.CI
	? describeProject(root, 0)
	: (readProject(root) ?? (await ensureSlot(root)));
const e2e = mode === "e2e";
const port = project.ports[e2e ? E2E_PORT[app] : APP_PORT[app]];
const env = {
	...process.env,
	...slotEnv(project, process.env, { e2e }),
	...(e2e && {
		// E2E servers run with CI settings and never touch the dev session.
		FUUTU_DISABLE_RATE_LIMIT: "1",
		EMAIL_PROVIDER: "console",
		FUUTU_TELEMETRY_DISABLED: "1",
		// Own build output: `next build` must not overwrite the dev server's `.next`.
		NEXT_DIST_DIR: ".next-e2e",
	}),
};
const next = (args) =>
	spawnSync("pnpm", ["exec", "next", ...args], {
		cwd: join(root, "apps", app),
		stdio: "inherit",
		env,
	}).status ?? 1;

/**
 * Fresh E2E database per run (like CI): drop, migrate, seed — all through
 * Prisma commands. Only for a local database; a remote one is never touched.
 */
function resetE2eDatabase() {
	const url = env.DATABASE_URL;
	// Only ever this slot's local `<database>-e2e` — never a remote, the dev
	// one or another project's.
	if (!isE2eResetTarget(url, project)) return 0;
	const maintenance = new URL(url);
	const name = decodeURIComponent(maintenance.pathname.slice(1));
	if (Buffer.byteLength(name) > 63) {
		process.stderr.write(
			`E2E database name "${name}" exceeds Postgres' 63-byte limit — shorten DATABASE_URL's database name.\n`,
		);
		return 1;
	}
	maintenance.pathname = "/postgres";
	const db = (args, { extra = {}, input } = {}) =>
		spawnSync("pnpm", ["--filter", "@fuutu/db", ...args], {
			cwd: root,
			stdio: input ? ["pipe", "inherit", "inherit"] : "inherit",
			input,
			env: { ...env, ...extra },
		}).status ?? 1;
	const dropped = db(["exec", "prisma", "db", "execute", "--stdin"], {
		extra: { DATABASE_URL: maintenance.toString() },
		input: `DROP DATABASE IF EXISTS "${name.replaceAll('"', '""')}" WITH (FORCE);`,
	});
	if (dropped !== 0) return dropped;
	const migrated = db(["exec", "prisma", "migrate", "deploy"]);
	if (migrated !== 0) return migrated;
	return db(["run", "db:seed"], { extra: { NODE_ENV: "development" } });
}

if (e2e) {
	const reset = resetE2eDatabase();
	if (reset !== 0) process.exit(reset);
	// `next build` with a custom distDir repoints next-env.d.ts at
	// `.next-e2e/types`; plain `tsc` would then depend on the E2E output.
	const nextEnvPath = join(root, "apps", app, "next-env.d.ts");
	const nextEnvSnapshot = existsSync(nextEnvPath)
		? readFileSync(nextEnvPath, "utf8")
		: null;
	const restoreNextEnv = () => {
		if (nextEnvSnapshot === null) return;
		if (readFileSync(nextEnvPath, "utf8") !== nextEnvSnapshot)
			writeFileSync(nextEnvPath, nextEnvSnapshot);
	};
	const built = next(["build", ...rest]);
	restoreNextEnv();
	if (built !== 0) process.exit(built);
	restoreNextEnv();
	process.exit(next(["start", "--port", String(port)]));
}
process.exit(next([mode, "--port", String(port), ...rest]));
