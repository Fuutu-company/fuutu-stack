#!/usr/bin/env node
/**
 * Runs a command with this project's port-slot environment (database, URLs,
 * buckets, cookie prefix — tooling/ports), so `pnpm db:migrate`, `db:push`,
 * `db:seed` and `db:studio` hit the slot's own database (`<db>-s<N>` in a git
 * worktree) instead of the main checkout's. Remote URLs are never rewritten.
 *
 *   node ../../tooling/scripts/with-slot-env.mjs dotenv -c -e ../../.env -- prisma migrate dev
 *   node ../../tooling/scripts/with-slot-env.mjs --print   # resolved DATABASE_URL, no command
 *
 * In CI there is no registry: the command runs unchanged.
 */
import { spawnSync } from "node:child_process";
import {
	commandSlotEnv,
	ensureSlot,
	findRoot,
	readProject,
} from "../ports/index.mjs";

const args = process.argv.slice(2);
const print = args[0] === "--print";
if (!print && args.length === 0) {
	process.stderr.write(
		"usage: with-slot-env.mjs [--print] <command> [args…]\n",
	);
	process.exit(1);
}

let overrides = {};
if (!process.env.CI) {
	const root = findRoot();
	const project = readProject(root) ?? (await ensureSlot(root));
	overrides = commandSlotEnv(root, project);
	if (print) {
		const url = overrides.DATABASE_URL ? new URL(overrides.DATABASE_URL) : null;
		process.stdout.write(
			`slot ${project.slot}  database ${url ? decodeURIComponent(url.pathname.slice(1)) : "(unchanged — remote or unset)"}\n`,
		);
		process.exit(0);
	}
}
if (print) process.exit(0);

const [cmd, ...rest] = args;
const result = spawnSync(cmd, rest, {
	stdio: "inherit",
	env: { ...process.env, ...overrides },
});
process.exit(result.status ?? 1);
