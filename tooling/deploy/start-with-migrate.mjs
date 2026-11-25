#!/usr/bin/env node
/**
 * Deploy start command: `prisma migrate deploy`, then the Next.js server.
 *
 *   node tooling/deploy/start-with-migrate.mjs <migrate-dir> <server.js>
 *
 * <migrate-dir> is the bundle from `bundle-migrate.mjs`. A failed migration
 * exits non-zero before the server starts, so a container never serves on a
 * half-migrated schema. `prisma migrate deploy` takes an advisory lock, so
 * replicas starting together are safe; a no-op when nothing is pending.
 *
 * MIGRATE_ON_START=0 skips the migration (multi-replica setups that migrate
 * from CI); unset or 1 migrates. Same values as the flag in `@fuutu/env/saas`
 * (1/true, 0/false), read here directly: this runs before the app and its env
 * validation load, and an unknown value stops the start.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

function fail(message, code = 1) {
	process.stderr.write(`[start] ${message}\n`);
	process.exit(code);
}

const [migrateArg, serverArg] = process.argv.slice(2);
if (!migrateArg || !serverArg) {
	fail("usage: start-with-migrate.mjs <migrate-dir> <server.js>");
}
const migrateDir = resolve(migrateArg);
const server = resolve(serverArg);

const FLAG = { 1: true, true: true, 0: false, false: false };
const raw = process.env.MIGRATE_ON_START ?? "";
if (raw !== "" && !Object.hasOwn(FLAG, raw)) {
	fail(`MIGRATE_ON_START must be 1/true or 0/false, got "${raw}"`);
}

if (raw !== "" && !FLAG[raw]) {
	process.stdout.write(
		`[start] MIGRATE_ON_START=${raw} — skipping migrations\n`,
	);
} else {
	const cli = join(migrateDir, "node_modules/prisma/build/index.js");
	if (!existsSync(cli)) fail(`no Prisma CLI at ${cli}`);
	process.stdout.write("[start] prisma migrate deploy\n");
	const result = spawnSync(process.execPath, [cli, "migrate", "deploy"], {
		cwd: migrateDir,
		stdio: "inherit",
		env: {
			...process.env,
			// No update check or usage ping from the deploy container.
			CHECKPOINT_DISABLE: "1",
			PRISMA_HIDE_UPDATE_MESSAGE: "1",
		},
	});
	if (result.error) fail(`migration did not run: ${result.error.message}`);
	if (result.status !== 0) {
		fail("migration failed — not starting the server", result.status ?? 1);
	}
}

if (!existsSync(server)) fail(`no server at ${server}`);
// In-process: the server owns this PID, so the platform's SIGTERM reaches it.
createRequire(import.meta.url)(server);
