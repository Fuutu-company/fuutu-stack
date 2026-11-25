#!/usr/bin/env node
/**
 * pnpm ports                 this project's slot + every project on this machine
 * pnpm ports status          same as `pnpm ports`
 *   --json                   the same as one JSON object (schemaVersion 1) for
 *                            editor tooling — read-only, never assigns a slot
 * pnpm ports ensure          assign a slot if missing (runs before every `pnpm dev`)
 * pnpm ports set <slot>      move this project to a specific slot
 * pnpm ports reassign        move this project to the next free slot
 * pnpm ports release [path]  free a project's slot (default: this project)
 * pnpm ports prune           list registered projects whose folder is gone or
 *                            no longer a project/worktree, and slots still
 *                            holding kept data (dry run); --yes drops them
 *
 *   release / prune --yes then offer to drop the slot's local database and
 *   buckets: asked interactively, kept without a terminal. --keep-data never
 *   asks, --drop-data drops without asking. Never released: running slots,
 *   and while their folder exists main checkouts, slot 0 and pinned slots —
 *   only git worktrees are temporary. A slot whose data was kept is handed out last.
 *   prune --yes also handles slots whose data was kept earlier (auto-pruned
 *   folder): same rules, and the record is cleared once the drop succeeded —
 *   or at once when no database or bucket of the slot exists any more.
 *   Unknown flags are rejected, never read as a path.
 *   Postgres and MinIO settings come from .env — in a worktree without one,
 *   from the main checkout's .env.
 * pnpm ports pin [slot]      make a slot the team's preferred slot (default: the
 *                            current one) — written to package.json, commit it
 * pnpm ports unpin           remove the preferred slot
 *
 * Writes .fuutu/project.json (per project) and ~/.fuutu/projects.json (per
 * machine). Both are generated — change them only through these commands.
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import {
	checkoutKind,
	clearKeptData,
	ensureSlot,
	findRoot,
	isLocal,
	isPortBusy,
	keptSlots,
	legacySlotDatabases,
	mainCheckoutRoot,
	minioCredentials,
	parseArgs,
	pinSlot,
	planKeptDrop,
	portsStatus,
	pruneRegistry,
	readPreferredSlot,
	readProject,
	readRegistry,
	releaseSlot,
	serviceEnv,
	setSlot,
	slotData,
	staleProjects,
} from "../ports/index.mjs";

const root = findRoot();
const out = (s = "") => process.stdout.write(`${s}\n`);
let parsed;
try {
	parsed = parseArgs(process.argv.slice(2));
} catch (err) {
	out(`[ports] ${err.message}`);
	process.exit(1);
}
const { command, arg, flags } = parsed;
const mainRoot = mainCheckoutRoot(root);

/** Postgres client for a local DATABASE_URL, via @fuutu/db's `pg`. */
async function withPostgres(fn) {
	const { env, source } = serviceEnv(root, "DATABASE_URL", { mainRoot });
	const url = env.DATABASE_URL;
	if (!url || !isLocal(url)) {
		out(`  database: no local DATABASE_URL (${source}) — kept`);
		return undefined;
	}
	const maintenance = new URL(url);
	maintenance.pathname = "/postgres";
	const require = createRequire(join(root, "packages/db/package.json"));
	const { Client } = require("pg");
	const client = new Client({ connectionString: maintenance.toString() });
	try {
		await client.connect();
		return await fn(client);
	} catch (err) {
		out(
			`  database: ${err.message} (DATABASE_URL from ${source}) — is Postgres running (\`pnpm db:start\`)?`,
		);
		return undefined;
	} finally {
		await client.end().catch(() => {});
	}
}

const listDatabases = () =>
	withPostgres(async (client) => {
		const { rows } = await client.query(
			"SELECT datname FROM pg_database WHERE NOT datistemplate",
		);
		return rows.map((r) => r.datname);
	});

/** Drops databases on the local Postgres — never a remote one. */
const dropDatabases = (names) =>
	withPostgres(async (client) => {
		for (const name of names) {
			await client.query(
				`DROP DATABASE IF EXISTS "${name.replaceAll('"', '""')}" WITH (FORCE)`,
			);
		}
		out(`  dropped databases ${names.join(", ")}`);
		return true;
	});

const CREDENTIAL_ERRORS = new Set([
	"InvalidAccessKeyId",
	"SignatureDoesNotMatch",
	"AccessDenied",
]);

/** Local MinIO client: `{ s3sdk, s3 }`, or a reason string when none applies. */
function minioClient() {
	const { env, source } = serviceEnv(root, "S3_ENDPOINT", { mainRoot });
	if (!env.S3_ENDPOINT || !isLocal(env.S3_ENDPOINT)) {
		return { skipped: `no local S3_ENDPOINT (${source})` };
	}
	const credentials = minioCredentials(env);
	const require = createRequire(join(root, "packages/storage/package.json"));
	const s3sdk = require("@aws-sdk/client-s3");
	const s3 = new s3sdk.S3Client({
		endpoint: env.S3_ENDPOINT,
		region: env.S3_REGION ?? "us-east-1",
		forcePathStyle: true,
		credentials: {
			accessKeyId: credentials.accessKeyId,
			secretAccessKey: credentials.secretAccessKey,
		},
	});
	return { s3sdk, s3, credentials, source };
}

/** Names of all local buckets, undefined when MinIO is not reachable. */
async function listBuckets() {
	try {
		const client = minioClient();
		if (client.skipped) return undefined;
		const { Buckets = [] } = await client.s3.send(
			new client.s3sdk.ListBucketsCommand({}),
		);
		return Buckets.map((b) => b.Name).filter(Boolean);
	} catch {
		return undefined;
	}
}

/** Empties and deletes the local MinIO buckets with the slot's prefix. */
async function dropBuckets(prefix) {
	let credentials;
	let source;
	try {
		const client = minioClient();
		if (client.skipped) {
			out(`  buckets: ${client.skipped} — kept`);
			return false;
		}
		const { s3sdk, s3 } = client;
		({ credentials, source } = client);
		const { Buckets = [] } = await s3.send(new s3sdk.ListBucketsCommand({}));
		const names = Buckets.map((b) => b.Name).filter((n) =>
			n?.startsWith(prefix),
		);
		for (const Bucket of names) {
			let token;
			do {
				const page = await s3.send(
					new s3sdk.ListObjectsV2Command({ Bucket, ContinuationToken: token }),
				);
				const Objects = (page.Contents ?? []).map(({ Key }) => ({ Key }));
				if (Objects.length) {
					await s3.send(
						new s3sdk.DeleteObjectsCommand({ Bucket, Delete: { Objects } }),
					);
				}
				token = page.NextContinuationToken;
			} while (token);
			await s3.send(new s3sdk.DeleteBucketCommand({ Bucket }));
		}
		out(
			names.length
				? `  dropped buckets ${names.join(", ")}`
				: `  no buckets with prefix ${prefix}`,
		);
		return true;
	} catch (err) {
		out(
			CREDENTIAL_ERRORS.has(err.name) && credentials
				? `  buckets: MinIO rejected access key "${credentials.accessKeyId}" (${credentials.from}, ${source}) — the compose MinIO accepts MINIO_ROOT_USER / MINIO_ROOT_PASSWORD from packages/db/.env, default minioadmin; set S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY to match`
				: `  bucket drop failed (${err.message}) — is MinIO running?`,
		);
		return false;
	}
}

async function confirm(question) {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	try {
		return /^y(es)?$/i.test((await rl.question(`${question} [y/N] `)).trim());
	} finally {
		rl.close();
	}
}

/** Data of a released slot: asked on a terminal, kept otherwise. */
async function handleData(released) {
	const data = slotData(released);
	if (!data) return;
	let { databases } = data;
	if (!databases.length) {
		// Registered before the database name was recorded: every local
		// `<name>-sN(-e2e)` no registered project uses.
		databases = legacySlotDatabases(
			released.slot,
			(await listDatabases()) ?? [],
		);
		if (databases.length) {
			out(
				`  database name of slot ${released.slot} not recorded — matched by suffix`,
			);
		}
	}
	const what = [
		databases.length ? `databases ${databases.join(", ")}` : null,
		`buckets ${data.bucketPrefix}*`,
	]
		.filter(Boolean)
		.join(" and ");
	if (flags.has("--keep-data")) return out(`  kept ${what}`);
	const drop =
		flags.has("--drop-data") ||
		(process.stdin.isTTY && (await confirm(`  Drop local ${what}?`)));
	if (!drop) {
		return out(
			`  kept ${what} — no terminal to confirm; drop it by hand if unneeded (--drop-data drops without asking)`,
		);
	}
	const dbOk = databases.length ? await dropDatabases(databases) : true;
	const bucketsOk = await dropBuckets(data.bucketPrefix);
	if (dbOk && bucketsOk) await clearKeptData(released.slot);
}

/**
 * Data of a slot whose registry entry is already gone (`keptData`): dropped
 * on --drop-data or after confirmation, left alone with --keep-data. A slot
 * with nothing left is cleared without asking.
 */
async function handleKept({ slot, path, database }) {
	const plan = planKeptDrop(
		{ slot, database },
		{ databases: await listDatabases(), buckets: await listBuckets() },
	);
	if (plan.empty) {
		await clearKeptData(slot);
		return out(`  slot ${slot}: nothing left from ${path} — record cleared`);
	}
	const what = [
		plan.databases.length ? `databases ${plan.databases.join(", ")}` : null,
		plan.buckets.length ? `buckets ${plan.buckets.join(", ")}` : null,
	]
		.filter(Boolean)
		.join(" and ");
	if (flags.has("--keep-data")) return out(`  slot ${slot}: kept ${what}`);
	const drop =
		flags.has("--drop-data") ||
		(process.stdin.isTTY &&
			(await confirm(`  Drop local ${what || "data"} of slot ${slot}?`)));
	if (!drop) {
		return out(
			`  slot ${slot}: kept ${what || "data"} — no terminal to confirm; --drop-data drops without asking`,
		);
	}
	const dbOk = plan.databases.length
		? await dropDatabases(plan.databases)
		: true;
	const bucketsOk = await dropBuckets(plan.bucketPrefix);
	if (dbOk && bucketsOk) await clearKeptData(slot);
}

async function list() {
	const project =
		readProject(root) ?? (await ensureSlot(root, { touch: false }));
	out(`${project.name}  slot ${project.slot}   (${root}/.fuutu/project.json)`);
	for (const [key, port] of Object.entries(project.ports)) {
		const up = (await isPortBusy(port)) ? "up" : "-";
		out(`  ${key.padEnd(13)} ${String(port).padEnd(6)} ${up}`);
	}
	out(`  database      ${project.database}`);
	const preferred = readPreferredSlot(root);
	out(
		`  preferred     ${preferred === undefined ? "none (pin one with `pnpm ports pin`)" : `slot ${preferred} (package.json)`}`,
	);
	out("");
	const registry = readRegistry();
	const stale = new Set(staleProjects(registry).map((p) => p.path));
	const gone = new Map((await pruneRegistry()).map((p) => [p.path, p.reason]));
	out("All projects on this machine (~/.fuutu/projects.json):");
	for (const [path, p] of Object.entries(registry.projects).sort(
		(a, b) => a[1].slot - b[1].slot,
	)) {
		const mark = path === root ? "*" : " ";
		const note = gone.has(path)
			? `  (${gone.get(path)} — \`pnpm ports prune\`)`
			: stale.has(path)
				? "  (not started for 90+ days)"
				: "";
		const kind = existsSync(path) ? checkoutKind(path).padEnd(8) : "gone    ";
		out(` ${mark} slot ${String(p.slot).padEnd(4)} ${kind} ${path}${note}`);
	}
	const kept = Object.entries(registry.keptData ?? {});
	if (kept.length) {
		out("");
		out("Free slots still holding a released project's data (taken last):");
		for (const [slot, k] of kept) {
			out(
				`   slot ${String(slot).padEnd(4)} ${k.database ?? "database unknown"} — from ${k.path}`,
			);
		}
	}
}

const commands = {
	list,
	status: list,
	ensure: async () => {
		const p = await ensureSlot(root);
		if (p.notice) out(`[ports] ${p.notice}`);
		out(
			`[ports] ${p.name}: slot ${p.slot} — SaaS ${p.urls.saas} · Marketing ${p.urls.marketing} · Docs ${p.urls.docs}`,
		);
	},
	set: async () => {
		const slot = Number(arg);
		if (!Number.isInteger(slot))
			throw new Error("usage: pnpm ports set <slot>");
		const p = await setSlot(root, slot);
		out(`[ports] moved to slot ${p.slot} — restart the apps`);
	},
	reassign: async () => {
		const p = await setSlot(root, undefined);
		out(`[ports] moved to slot ${p.slot} — restart the apps`);
	},
	pin: async () => {
		const slot = arg === undefined ? readProject(root)?.slot : Number(arg);
		if (!Number.isInteger(slot))
			throw new Error("usage: pnpm ports pin [slot]");
		await pinSlot(root, slot);
		const p = await ensureSlot(root);
		out(
			`[ports] preferred slot ${slot} written to package.json — commit it so every clone uses the same ports`,
		);
		if (p.notice) out(`[ports] ${p.notice}`);
	},
	unpin: async () => {
		await pinSlot(root, undefined);
		out("[ports] preferred slot removed from package.json");
	},
	release: async () => {
		const released = await releaseSlot(arg ?? root);
		out(`[ports] released slot ${released.slot} (${released.path})`);
		await handleData(released);
	},
	prune: async () => {
		const apply = flags.has("--yes");
		const found = await pruneRegistry({ apply, keep: root });
		const kept = keptSlots();
		if (!found.length && !kept.length) return out("[ports] nothing to prune");
		for (const p of found) {
			const action = p.kept
				? `kept: ${p.kept}`
				: apply
					? "dropped"
					: "would drop";
			out(
				`  slot ${String(p.slot).padEnd(4)} ${p.path}  (${p.reason}; ${action})`,
			);
		}
		if (!apply) {
			for (const k of kept) {
				out(
					`  slot ${String(k.slot).padEnd(4)} holds data kept from ${k.path} (${k.database ? `database ${k.database}` : "database unknown"})`,
				);
			}
			return out(
				"[ports] dry run — `pnpm ports prune --yes` drops the entries and their data",
			);
		}
		for (const k of kept) {
			out(`[ports] slot ${k.slot} data:`);
			await handleKept(k);
		}
	},
};

if (flags.has("--json")) {
	if (command !== "list" && command !== "status") {
		out("[ports] --json works with `status` (or no command) only");
		process.exit(1);
	}
	commands[command] = async () =>
		out(JSON.stringify(await portsStatus(root), null, 2));
}
if (!commands[command]) {
	out(
		`unknown command "${command}" — use list | status [--json] | ensure | set <slot> | reassign | pin [slot] | unpin | release [path] | prune [--yes]`,
	);
	process.exit(1);
}
commands[command]().catch((err) => {
	out(`[ports] ${err.message}`);
	process.exit(1);
});
