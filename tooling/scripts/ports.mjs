#!/usr/bin/env node
/**
 * pnpm ports                 this project's slot + every project on this machine
 * pnpm ports ensure          assign a slot if missing (runs before every `pnpm dev`)
 * pnpm ports set <slot>      move this project to a specific slot
 * pnpm ports reassign        move this project to the next free slot
 * pnpm ports release [path]  free a project's slot (default: this project)
 * pnpm ports prune           list registered projects whose folder is gone or
 *                            no longer a project/worktree (dry run); --yes drops them
 *
 *   release / prune --yes then offer to drop the slot's local database and
 *   buckets: asked interactively, kept without a terminal. --keep-data never
 *   asks, --drop-data drops without asking. Slot 0, pinned and running slots
 *   are never released.
 * pnpm ports pin [slot]      make a slot the team's preferred slot (default: the
 *                            current one) — written to package.json, commit it
 * pnpm ports unpin           remove the preferred slot
 *
 * Writes .fuutu/project.json (per project) and ~/.fuutu/projects.json (per
 * machine). Both are generated — change them only through these commands.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import {
	ensureSlot,
	findRoot,
	isLocal,
	isPortBusy,
	pinSlot,
	pruneRegistry,
	readDotEnv,
	readPreferredSlot,
	readProject,
	readRegistry,
	releaseSlot,
	setSlot,
	slotData,
	staleProjects,
} from "../ports/index.mjs";

const root = findRoot();
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const [command = "list", arg] = argv.filter((a) => !a.startsWith("--"));
const out = (s = "") => process.stdout.write(`${s}\n`);
const localEnv = () => ({ ...readDotEnv(root), ...process.env });

/** Drops databases on this project's local Postgres — never a remote one. */
function dropDatabases(names) {
	const url = localEnv().DATABASE_URL;
	if (!url || !isLocal(url)) {
		out("  database: no local DATABASE_URL in .env — kept");
		return;
	}
	const maintenance = new URL(url);
	maintenance.pathname = "/postgres";
	const sql = names
		.map(
			(n) =>
				`DROP DATABASE IF EXISTS "${n.replaceAll('"', '""')}" WITH (FORCE);`,
		)
		.join("\n");
	const { status } = spawnSync(
		"pnpm",
		["--filter", "@fuutu/db", "exec", "prisma", "db", "execute", "--stdin"],
		{
			cwd: root,
			input: sql,
			stdio: ["pipe", "ignore", "inherit"],
			env: { ...process.env, DATABASE_URL: maintenance.toString() },
		},
	);
	out(
		status === 0
			? `  dropped databases ${names.join(", ")}`
			: "  database drop failed — is Postgres running (`pnpm db:start`)?",
	);
}

/** Empties and deletes the local MinIO buckets with the slot's prefix. */
async function dropBuckets(prefix) {
	const env = localEnv();
	if (!env.S3_ENDPOINT || !isLocal(env.S3_ENDPOINT)) {
		out("  buckets: no local S3_ENDPOINT in .env — kept");
		return;
	}
	try {
		const require = createRequire(join(root, "packages/storage/package.json"));
		const s3sdk = require("@aws-sdk/client-s3");
		const s3 = new s3sdk.S3Client({
			endpoint: env.S3_ENDPOINT,
			region: env.S3_REGION ?? "us-east-1",
			forcePathStyle: true,
			credentials: {
				accessKeyId: env.S3_ACCESS_KEY_ID ?? "",
				secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? "",
			},
		});
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
	} catch (err) {
		out(`  bucket drop failed (${err.message}) — is MinIO running?`);
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
	const what = [
		data.databases.length ? `databases ${data.databases.join(", ")}` : null,
		`buckets ${data.bucketPrefix}*`,
	]
		.filter(Boolean)
		.join(" and ");
	if (!data.databases.length) {
		out(
			`  database name of slot ${released.slot} unknown — left alone, drop it by hand if needed`,
		);
	}
	if (flags.has("--keep-data")) return out(`  kept ${what}`);
	const drop =
		flags.has("--drop-data") ||
		(process.stdin.isTTY && (await confirm(`  Drop local ${what}?`)));
	if (!drop) {
		return out(
			`  kept ${what} — no terminal to confirm; drop it by hand if unneeded (--drop-data drops without asking)`,
		);
	}
	if (data.databases.length) dropDatabases(data.databases);
	await dropBuckets(data.bucketPrefix);
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
		out(` ${mark} slot ${String(p.slot).padEnd(4)} ${path}${note}`);
	}
}

const commands = {
	list,
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
		if (!found.length) return out("[ports] nothing to prune");
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
			return out("[ports] dry run — `pnpm ports prune --yes` drops them");
		}
		for (const p of found.filter((f) => !f.kept)) {
			out(`[ports] slot ${p.slot} data:`);
			await handleData(p);
		}
	},
};

if (!commands[command]) {
	out(
		`unknown command "${command}" — use list | ensure | set <slot> | reassign | pin [slot] | unpin | release [path] | prune [--yes]`,
	);
	process.exit(1);
}
commands[command]().catch((err) => {
	out(`[ports] ${err.message}`);
	process.exit(1);
});
