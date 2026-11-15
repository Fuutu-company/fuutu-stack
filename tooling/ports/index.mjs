/**
 * Port slots — run many Fuutu Stack projects (and git worktrees) on one
 * machine without port clashes.
 *
 * Every project gets a SLOT, recorded in a machine-wide registry
 * (~/.fuutu/projects.json) and in the project's .fuutu/project.json. A slot
 * owns two port ranges: apps (SaaS, Marketing, room for mobile/desktop/…)
 * and docs/tools (Docs, Mail preview, E2E servers, session browser).
 * Slot 0 = the classic ports (3000/3001/4000). Slots never move once
 * assigned, so two registered projects can never meet — running or not.
 *
 * Every local command that touches the database (`pnpm dev`, E2E, `pnpm
 * db:migrate | db:push | db:seed | db:studio`) runs with the slot's env
 * (tooling/scripts/with-slot-env.mjs), so a git worktree never writes into the
 * main checkout's database. Remote URLs are never rewritten.
 *
 * Local development only: deployments use fixed container ports.
 */

import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { createConnection } from "node:net";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

export const PROJECT_FILE = ".fuutu/project.json";

/** Offsets inside a slot's apps range (+0 … +49 reserved for apps). */
export const APP_OFFSETS = { saas: 0, marketing: 1 };
/** Offsets inside a slot's docs/tools range. */
export const TOOL_OFFSETS = {
	docs: 0,
	mailPreview: 3,
	e2eSaas: 50,
	e2eMarketing: 51,
	e2eDocs: 52,
	browser: 99,
};

/** Slots 0–9 use 3000/4000 + 100·slot; from slot 10 on, 200-port blocks from 10000. */
const CLASSIC_SLOTS = 10;
const HIGH_BASE = 10_000;
const HIGH_LIMIT = 48_999; // below the OS ephemeral range (49152+)
export const MAX_SLOT =
	CLASSIC_SLOTS - 1 + Math.floor((HIGH_LIMIT + 1 - HIGH_BASE) / 200);

/** Well-known dev ports a slot's ranges must not cover. */
export const RESERVED_PORTS = [
	3306, 5432, 5672, 6379, 8000, 8080, 8443, 8888, 9000, 9001, 9200, 9222, 9229,
	11211, 15672, 27017, 33060,
];

const STALE_DAYS = 90;

export function slotRanges(slot) {
	if (!Number.isInteger(slot) || slot < 0 || slot > MAX_SLOT) {
		throw new Error(`slot must be an integer between 0 and ${MAX_SLOT}`);
	}
	if (slot < CLASSIC_SLOTS) {
		return { apps: 3000 + 100 * slot, tools: 4000 + 100 * slot };
	}
	const base = HIGH_BASE + 200 * (slot - CLASSIC_SLOTS);
	return { apps: base, tools: base + 100 };
}

export function slotPorts(slot) {
	const { apps, tools } = slotRanges(slot);
	return {
		saas: apps + APP_OFFSETS.saas,
		marketing: apps + APP_OFFSETS.marketing,
		docs: tools + TOOL_OFFSETS.docs,
		mailPreview: tools + TOOL_OFFSETS.mailPreview,
		e2eSaas: tools + TOOL_OFFSETS.e2eSaas,
		e2eMarketing: tools + TOOL_OFFSETS.e2eMarketing,
		e2eDocs: tools + TOOL_OFFSETS.e2eDocs,
		browser: tools + TOOL_OFFSETS.browser,
	};
}

/** A slot is usable when neither of its ranges touches a reserved port. */
export function isSlotAllowed(slot) {
	const { apps, tools } = slotRanges(slot);
	return !RESERVED_PORTS.some(
		(p) => (p >= apps && p < apps + 50) || (p >= tools && p < tools + 100),
	);
}

// ── registry ────────────────────────────────────────────────────────────

const fuutuHome = () => process.env.FUUTU_HOME ?? join(homedir(), ".fuutu");
const registryPath = () => join(fuutuHome(), "projects.json");

export function readRegistry() {
	try {
		const data = JSON.parse(readFileSync(registryPath(), "utf8"));
		return { version: 1, projects: {}, keptData: {}, ...data };
	} catch {
		return { version: 1, projects: {}, keptData: {} };
	}
}

/**
 * Removes a project from the registry. Its slot's local data stays behind
 * until dropped (clearKeptData), so allocation prefers other slots.
 */
function forget(registry, path) {
	const entry = registry.projects[path];
	delete registry.projects[path];
	if (!entry || !Number.isInteger(entry.slot) || entry.slot === 0) return;
	registry.keptData = {
		...registry.keptData,
		[entry.slot]: {
			path,
			database: entry.database ?? null,
			keptAt: new Date().toISOString(),
		},
	};
}

/** The slot's local data was dropped — it counts as clean again. */
export async function clearKeptData(slot) {
	await withRegistryLock(async () => {
		const registry = readRegistry();
		if (!registry.keptData?.[slot]) return;
		delete registry.keptData[slot];
		writeRegistry(registry);
	});
}

function writeRegistry(registry) {
	mkdirSync(fuutuHome(), { recursive: true });
	const tmp = `${registryPath()}.${process.pid}.tmp`;
	writeFileSync(tmp, `${JSON.stringify(registry, null, 2)}\n`);
	renameSync(tmp, registryPath());
}

/** Cross-process lock (mkdir is atomic) — turbo starts all apps at once. */
async function withRegistryLock(fn) {
	mkdirSync(fuutuHome(), { recursive: true });
	const lock = join(fuutuHome(), "projects.lock");
	for (let i = 0; i < 100; i++) {
		try {
			mkdirSync(lock);
			try {
				return await fn();
			} finally {
				rmSync(lock, { recursive: true, force: true });
			}
		} catch (err) {
			if (err.code !== "EEXIST") throw err;
			// A lock older than 30s belongs to a crashed process.
			try {
				if (Date.now() - statSync(lock).mtimeMs > 30_000) {
					rmSync(lock, { recursive: true, force: true });
				}
			} catch {}
			await new Promise((r) => setTimeout(r, 100));
		}
	}
	throw new Error(`could not lock ${lock}`);
}

// ── project ─────────────────────────────────────────────────────────────

/** Repository root: nearest parent with pnpm-workspace.yaml. */
export function findRoot(from = process.cwd()) {
	let dir = resolve(from);
	while (!existsSync(join(dir, "pnpm-workspace.yaml"))) {
		const up = dirname(dir);
		if (up === dir) throw new Error(`no pnpm workspace above ${from}`);
		dir = up;
	}
	return dir;
}

/** Minimal .env reader (KEY=value, optional quotes) — no dependency. */
export function readDotEnv(root) {
	const file = join(root, ".env");
	if (!existsSync(file)) return {};
	const out = {};
	for (const line of readFileSync(file, "utf8").split("\n")) {
		const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
		if (!m) continue;
		out[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
	}
	return out;
}

const dbNameOf = (url) => {
	try {
		return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
	} catch {
		return null;
	}
};

/** Everything a slot means for one project — written to .fuutu/project.json. */
export function describeProject(root, slot, dotEnv = readDotEnv(root)) {
	const ports = slotPorts(slot);
	const suffix = slot === 0 ? "" : `-s${slot}`;
	const baseDb = (dbNameOf(dotEnv.DATABASE_URL ?? "") ?? "fuutu").replace(
		/-s\d+$/,
		"",
	);
	return {
		$comment:
			"Generated by `pnpm ports` — do not edit. Change with `pnpm ports set <slot>` or `pnpm ports reassign`.",
		name: basename(root),
		root,
		slot,
		ports,
		urls: {
			saas: `http://localhost:${ports.saas}`,
			marketing: `http://localhost:${ports.marketing}`,
			docs: `http://localhost:${ports.docs}`,
			mailPreview: `http://localhost:${ports.mailPreview}`,
			browserCdp: `http://127.0.0.1:${ports.browser}`,
		},
		database: `${baseDb}${suffix}`,
		storageBucketPrefix: slot === 0 ? "" : `s${slot}-`,
		authCookiePrefix: slot === 0 ? "better-auth" : `better-auth${suffix}`,
	};
}

/**
 * The recorded project. A file written for another port layout (a kit
 * update added a port) is rewritten for the same slot first.
 */
export function readProject(root) {
	let project;
	try {
		project = JSON.parse(readFileSync(join(root, PROJECT_FILE), "utf8"));
	} catch {
		return null;
	}
	if (!Number.isInteger(project?.slot)) return project;
	let current;
	try {
		current = slotPorts(project.slot);
	} catch {
		return project;
	}
	const recorded = project.ports ?? {};
	const keys = Object.keys(current);
	const refreshed = describeProject(root, project.slot);
	// The database name follows .env — a slot first taken before .env existed
	// must not keep the `fuutu-s<N>` fallback once the real name is known.
	const same =
		keys.length === Object.keys(recorded).length &&
		keys.every((key) => recorded[key] === current[key]) &&
		project.database === refreshed.database;
	if (same) return project;
	writeProject(root, refreshed);
	return refreshed;
}

function writeProject(root, project) {
	mkdirSync(join(root, ".fuutu"), { recursive: true });
	writeFileSync(
		join(root, PROJECT_FILE),
		`${JSON.stringify(project, null, 2)}\n`,
	);
}

export const isPortBusy = (port) =>
	new Promise((done) => {
		const socket = createConnection({ port, host: "127.0.0.1" });
		socket.setTimeout(500);
		socket.once("connect", () => {
			socket.destroy();
			done(true);
		});
		socket.once("error", () => done(false));
		socket.once("timeout", () => {
			socket.destroy();
			done(false);
		});
	});

const slotPortList = (slot) => {
	const p = slotPorts(slot);
	return [p.saas, p.marketing, p.docs, p.mailPreview, p.browser];
};

/** Every port a slot owns — apps, docs/tools, E2E servers, session browser. */
const allSlotPorts = (slot) => Object.values(slotPorts(slot));

/** True when any of the slot's ports answers — a session is running on it. */
export async function isSlotRunning(slot, busy = isPortBusy) {
	const used = await Promise.all(allSlotPorts(slot).map((p) => busy(p)));
	return used.some(Boolean);
}

/**
 * Why a registered path no longer holds a project: "missing" (folder gone),
 * "not-a-project" (no pnpm-workspace.yaml) or "orphaned-worktree" (its .git
 * file points at a worktree git no longer knows). null = still a project.
 */
export function projectGone(path) {
	if (!existsSync(path)) return "missing";
	if (!existsSync(join(path, "pnpm-workspace.yaml"))) return "not-a-project";
	try {
		const git = join(path, ".git");
		if (statSync(git).isFile()) {
			const gitdir = /^gitdir:\s*(.+)$/m.exec(readFileSync(git, "utf8"))?.[1];
			if (gitdir && !existsSync(resolve(path, gitdir.trim()))) {
				return "orphaned-worktree";
			}
		}
	} catch {}
	return null;
}

/**
 * Why an entry must keep its slot: a running session, or — while its folder
 * exists — slot 0 or a pinned slot.
 */
async function protectedReason(path, entry, busy) {
	if (existsSync(path)) {
		if (entry.slot === 0) return "slot 0";
		if (readPreferredSlot(path) === entry.slot) {
			return "pinned (fuutu.preferredSlot)";
		}
	}
	if (await isSlotRunning(entry.slot, busy)) return "running";
	return null;
}

/**
 * Registry entries that no longer hold a project. `apply` drops the ones
 * that are not protected; without it nothing changes (dry run). `missingOnly`
 * limits it to deleted folders (the automatic prune on start).
 */
export async function pruneRegistry({
	apply = false,
	busy = isPortBusy,
	keep,
	missingOnly = false,
} = {}) {
	const run = async () => {
		const registry = readRegistry();
		const found = [];
		for (const [path, entry] of Object.entries(registry.projects)) {
			if (path === keep) continue;
			const reason = projectGone(path);
			if (!reason || (missingOnly && reason !== "missing")) continue;
			const kept = await protectedReason(path, entry, busy);
			found.push({ path, ...entry, reason, kept });
			if (apply && !kept) forget(registry, path);
		}
		if (apply && found.some((f) => !f.kept)) writeRegistry(registry);
		return found;
	};
	return apply ? withRegistryLock(run) : run();
}

/** The automatic prune on start: deleted folders only, never data. */
async function pruneLocked(root, busy) {
	const registry = readRegistry();
	let changed = false;
	for (const [path, entry] of Object.entries(registry.projects)) {
		if (path === root || projectGone(path) !== "missing") continue;
		if (await protectedReason(path, entry, busy)) continue;
		forget(registry, path);
		changed = true;
	}
	if (changed) writeRegistry(registry);
}

export function staleProjects(registry, now = Date.now()) {
	return Object.entries(registry.projects)
		.filter(([, p]) => {
			const last = p.lastStarted ?? p.registeredAt;
			return !last || now - Date.parse(last) > STALE_DAYS * 86_400_000;
		})
		.map(([path, p]) => ({ path, ...p }));
}

/**
 * The project's slot: kept if registered, otherwise the lowest slot no other
 * registered project owns, that avoids reserved ports and whose ports are not
 * in use by other software right now.
 */
export async function ensureSlot(
	root,
	{ busy = isPortBusy, touch = true } = {},
) {
	return withRegistryLock(async () => {
		await pruneLocked(root, busy);
		const registry = readRegistry();
		const taken = new Map(
			Object.entries(registry.projects)
				.filter(([path]) => path !== root)
				.map(([path, p]) => [p.slot, path]),
		);
		let slot = registry.projects[root]?.slot;
		const recorded = readProject(root)?.slot;
		let notice;

		// Team-wide choice committed in package.json — taken whenever it is
		// free on this machine, even if the project had another slot so far.
		const preferred = readPreferredSlot(root);
		if (preferred !== undefined && slot !== preferred) {
			const owner = taken.get(preferred);
			if (owner) {
				notice = `preferred slot ${preferred} belongs to ${owner} on this machine — this project stays on its own slot`;
			} else if (!isSlotAllowed(preferred)) {
				notice = `preferred slot ${preferred} overlaps a reserved port — ignored`;
			} else {
				const used = await Promise.all(
					slotPortList(preferred).map((p) => busy(p)),
				);
				if (used.some(Boolean)) {
					notice = `preferred slot ${preferred} has ports in use by other software — this project stays on its own slot`;
				} else {
					if (slot !== undefined) {
						notice = `moved this project from slot ${slot} to slot ${preferred} (preferred slot in package.json)`;
					}
					slot = preferred;
				}
			}
		}
		if (
			slot === undefined &&
			Number.isInteger(recorded) &&
			!taken.has(recorded)
		) {
			slot = recorded;
		}
		// Clean slots first; a slot whose released data was kept only when
		// no clean one is left.
		const kept = registry.keptData ?? {};
		for (const allowKept of [false, true]) {
			if (slot !== undefined) break;
			for (let s = 0; s <= MAX_SLOT; s++) {
				if (taken.has(s) || !isSlotAllowed(s)) continue;
				if (!allowKept && kept[s]) continue;
				const used = await Promise.all(slotPortList(s).map((p) => busy(p)));
				if (used.some(Boolean)) continue;
				slot = s;
				break;
			}
		}
		if (slot === undefined) {
			const stale = staleProjects(registry)
				.map((p) => `  slot ${p.slot}  ${p.path}`)
				.join("\n");
			throw new Error(
				`all ${MAX_SLOT + 1} port slots are taken. Free one with \`pnpm ports release <path>\`.${stale ? `\nNot started for ${STALE_DAYS}+ days:\n${stale}` : ""}`,
			);
		}
		const leftover = kept[slot];
		if (leftover) {
			if (leftover.path !== root) {
				const warning = `slot ${slot} still holds data kept from ${leftover.path}${leftover.database ? ` (database ${leftover.database})` : ""} — no clean slot was left; drop it or reset this project's database`;
				notice = notice ? `${notice}; ${warning}` : warning;
			}
			delete registry.keptData[slot];
		}
		const project = describeProject(root, slot);
		registry.projects[root] = {
			slot,
			name: basename(root),
			database: project.database,
			registeredAt:
				registry.projects[root]?.registeredAt ?? new Date().toISOString(),
			lastStarted: touch
				? new Date().toISOString()
				: (registry.projects[root]?.lastStarted ?? null),
		};
		writeRegistry(registry);
		writeProject(root, project);
		return notice ? { ...project, notice } : project;
	});
}

/** Moves the project to `slot` (or the next free one when undefined). */
export async function setSlot(root, slot, opts = {}) {
	await withRegistryLock(async () => {
		const registry = readRegistry();
		if (slot !== undefined) {
			slotRanges(slot);
			if (!isSlotAllowed(slot)) {
				throw new Error(`slot ${slot} overlaps a reserved port`);
			}
			const owner = Object.entries(registry.projects).find(
				([path, p]) => p.slot === slot && path !== root,
			);
			if (owner) throw new Error(`slot ${slot} belongs to ${owner[0]}`);
		}
		if (registry.projects[root]?.slot === slot) delete registry.projects[root];
		else forget(registry, root);
		if (slot !== undefined) {
			registry.projects[root] = {
				slot,
				name: basename(root),
				lastStarted: null,
			};
		}
		writeRegistry(registry);
		rmSync(join(root, PROJECT_FILE), { force: true });
	});
	return ensureSlot(root, opts);
}

/** `fuutu.preferredSlot` in the root package.json (committed, team-wide). */
export function readPreferredSlot(root) {
	try {
		const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
		const slot = pkg.fuutu?.preferredSlot;
		return Number.isInteger(slot) && slot >= 0 && slot <= MAX_SLOT
			? slot
			: undefined;
	} catch {
		return undefined;
	}
}

/**
 * Sets (or with `undefined` removes) the team's preferred slot in the root
 * package.json — commit it so every clone aims for the same ports.
 */
export async function pinSlot(root, slot) {
	if (slot !== undefined) {
		slotRanges(slot);
		if (!isSlotAllowed(slot)) {
			throw new Error(`slot ${slot} overlaps a reserved port`);
		}
	}
	const file = join(root, "package.json");
	const raw = readFileSync(file, "utf8");
	const pkg = JSON.parse(raw);
	const indent = /^(\s+)"/m.exec(raw)?.[1] ?? "\t";
	const { preferredSlot: _old, ...rest } = pkg.fuutu ?? {};
	const fuutu = slot === undefined ? rest : { ...rest, preferredSlot: slot };
	if (Object.keys(fuutu).length) pkg.fuutu = fuutu;
	else delete pkg.fuutu;
	writeFileSync(file, `${JSON.stringify(pkg, null, indent)}\n`);
}

/**
 * Frees a project's slot in the registry. Never a running slot; slot 0 and
 * a pinned slot only when the folder is gone. Data is left alone — the
 * result names what belonged to the slot (see slotData).
 */
export async function releaseSlot(path, { busy = isPortBusy } = {}) {
	const abs = resolve(path);
	return withRegistryLock(async () => {
		const registry = readRegistry();
		const entry = registry.projects[abs];
		if (!entry) throw new Error(`${abs} has no slot on this machine`);
		const kept = await protectedReason(abs, entry, busy);
		if (kept === "running") {
			throw new Error(
				`slot ${entry.slot} is running (its ports answer) — stop it first`,
			);
		}
		if (kept && existsSync(abs)) {
			throw new Error(
				`slot ${entry.slot} is never released while its project exists (${kept}) — move it with \`pnpm ports set\` or \`pnpm ports unpin\``,
			);
		}
		const database =
			(existsSync(abs) ? readProject(abs)?.database : undefined) ??
			entry.database ??
			null;
		registry.projects[abs] = { ...entry, database };
		forget(registry, abs);
		writeRegistry(registry);
		return { path: abs, ...entry, database };
	});
}

/**
 * What local data a released slot leaves behind, limited to names that can
 * only be that slot's: `<db>-s<N>` (+ `-e2e`) and buckets `s<N>-…`. Nothing
 * for slot 0, an unknown database name, or a slot another project now holds.
 */
export function slotData(released, registry = readRegistry()) {
	const { slot } = released;
	if (!Number.isInteger(slot) || slot === 0) return null;
	if (Object.values(registry.projects).some((p) => p.slot === slot)) {
		return null;
	}
	const db = released.database;
	const inUse = databasesInUse(registry);
	const safeDb = typeof db === "string" && db.endsWith(`-s${slot}`);
	return {
		databases: safeDb
			? [db, `${db}-e2e`].filter((name) => !inUse.has(name))
			: [],
		bucketPrefix: `s${slot}-`,
	};
}

/**
 * Every database name a registered project may use: recorded in the
 * registry, in its .fuutu/project.json, or derived from its .env now —
 * each with its `-e2e` twin.
 */
export function databasesInUse(registry = readRegistry()) {
	const names = new Set();
	for (const [path, entry] of Object.entries(registry.projects)) {
		const found = [entry.database];
		if (existsSync(path)) {
			try {
				found.push(
					JSON.parse(readFileSync(join(path, PROJECT_FILE), "utf8")).database,
				);
			} catch {}
			if (Number.isInteger(entry.slot)) {
				try {
					found.push(describeProject(path, entry.slot).database);
				} catch {}
			}
		}
		for (const name of found) {
			if (typeof name !== "string" || !name) continue;
			names.add(name);
			names.add(`${name}-e2e`);
		}
	}
	return names;
}

/**
 * For a released slot whose database name was never recorded: the local
 * databases that can only be that slot's (`<name>-s<N>` or `<name>-s<N>-e2e`),
 * minus every name a registered project uses.
 */
export function legacySlotDatabases(slot, names, inUse = databasesInUse()) {
	if (!Number.isInteger(slot) || slot === 0) return [];
	const pattern = new RegExp(`^.+-s${slot}(-e2e)?$`);
	return names.filter((name) => pattern.test(name) && !inUse.has(name));
}

/**
 * The main checkout of a git worktree (parent of `git rev-parse
 * --git-common-dir`), or null for the main checkout itself / no git.
 */
export function mainCheckoutRoot(root) {
	const res = spawnSync("git", ["rev-parse", "--git-common-dir"], {
		cwd: root,
		encoding: "utf8",
	});
	if (res.status !== 0) return null;
	const main = dirname(resolve(root, res.stdout.trim()));
	return main !== resolve(root) && existsSync(join(main, "pnpm-workspace.yaml"))
		? main
		: null;
}

/**
 * Env for a local service the CLI talks to (Postgres, MinIO), taken whole
 * from the first source that sets `key`: the process env, this checkout's
 * .env, or — in a fresh worktree without one — the main checkout's .env.
 */
export function serviceEnv(root, key, { env = process.env, mainRoot } = {}) {
	if (env[key])
		return { env: { ...readDotEnv(root), ...env }, source: "process env" };
	const own = readDotEnv(root);
	if (own[key]) return { env: own, source: join(root, ".env") };
	if (mainRoot) {
		const main = readDotEnv(mainRoot);
		if (main[key]) return { env: main, source: join(mainRoot, ".env") };
	}
	return {
		env: {},
		source: `${key} not set in the process env, .env${mainRoot ? " or the main checkout's .env" : ""}`,
	};
}

/**
 * MinIO credentials: S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY, else the
 * MINIO_ROOT_* pair, else the compose default (minioadmin).
 */
export function minioCredentials(env) {
	if (env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY) {
		return {
			accessKeyId: env.S3_ACCESS_KEY_ID,
			secretAccessKey: env.S3_SECRET_ACCESS_KEY,
			from: "S3_ACCESS_KEY_ID",
		};
	}
	if (env.MINIO_ROOT_USER && env.MINIO_ROOT_PASSWORD) {
		return {
			accessKeyId: env.MINIO_ROOT_USER,
			secretAccessKey: env.MINIO_ROOT_PASSWORD,
			from: "MINIO_ROOT_USER",
		};
	}
	return {
		accessKeyId: "minioadmin",
		secretAccessKey: "minioadmin",
		from: "compose default",
	};
}

// ── environment ─────────────────────────────────────────────────────────

const LOCAL_PROTOCOLS = new Set([
	"http:",
	"https:",
	"postgres:",
	"postgresql:",
]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** Parsed URL, or null when the value is not one. */
function parseUrl(value) {
	try {
		return new URL(value);
	} catch {
		return null;
	}
}

/**
 * Unset → local (the slot defaults apply). Otherwise only a parsable
 * http(s)/postgres URL whose parsed host is exactly localhost, 127.0.0.1
 * or ::1 — a username like `localhost:5432@remote` never counts.
 */
export function isLocal(value) {
	if (!value) return true;
	const url = parseUrl(value);
	return (
		url !== null &&
		LOCAL_PROTOCOLS.has(url.protocol) &&
		LOCAL_HOSTS.has(url.hostname.toLowerCase())
	);
}

/**
 * The E2E reset drops this database — only ever the slot's own local
 * `<database>-e2e`, never a remote, the dev one or another project's.
 */
export function isE2eResetTarget(value, project) {
	if (!value || !isLocal(value)) return false;
	const url = parseUrl(value);
	try {
		return (
			decodeURIComponent(url.pathname.slice(1)) === `${project.database}-e2e`
		);
	} catch {
		return false;
	}
}

/**
 * Set in every slot env to `<slot>:<root>` so this project's child commands
 * don't re-apply it. A marker of another checkout (a shell spawned by its
 * dev session or E2E run) does not match and is resolved again.
 */
export const SLOT_ENV_MARKER = "FUUTU_SLOT_ENV";
const slotEnvMark = (project) => `${project.slot}:${project.root}`;

/**
 * Env for an app process of this project. Local URLs (unset or pointing at
 * localhost) follow the slot; explicit remote values (a tunnel, a cloud DB)
 * are never touched. `e2e` points SaaS/Marketing/Docs at the slot's E2E ports.
 */
export function slotEnv(project, env = process.env, { e2e = false } = {}) {
	const { ports } = project;
	const saas = `http://localhost:${e2e ? ports.e2eSaas : ports.saas}`;
	const marketing = `http://localhost:${e2e ? ports.e2eMarketing : ports.marketing}`;
	const docs = `http://localhost:${e2e ? ports.e2eDocs : ports.docs}`;
	const out = {};
	const set = (key, value) => {
		if (isLocal(env[key])) out[key] = value;
	};
	set("BETTER_AUTH_URL", saas);
	set("NEXT_PUBLIC_SAAS_URL", saas);
	set("NEXT_PUBLIC_MARKETING_URL", marketing);
	set("NEXT_PUBLIC_DOCS_URL", docs);
	set("CORS_ORIGIN", marketing);
	if (env.POLAR_SUCCESS_URL && isLocal(env.POLAR_SUCCESS_URL)) {
		out.POLAR_SUCCESS_URL = `${saas}/dashboard`;
	}
	if (env.DATABASE_URL && isLocal(env.DATABASE_URL)) {
		const url = new URL(env.DATABASE_URL);
		// E2E servers get their own database (reset per run by next.mjs) —
		// tests never write into the dev session's data.
		url.pathname = `/${project.database}${e2e ? "-e2e" : ""}`;
		out.DATABASE_URL = url.toString();
	}
	if (project.storageBucketPrefix && isLocal(env.S3_ENDPOINT)) {
		for (const key of Object.keys(env)) {
			if (
				/^S3_BUCKET_/.test(key) &&
				env[key] &&
				!env[key].startsWith(project.storageBucketPrefix)
			) {
				out[key] = `${project.storageBucketPrefix}${env[key]}`;
			}
		}
	}
	out.FUUTU_AUTH_COOKIE_PREFIX = project.authCookiePrefix;
	out[SLOT_ENV_MARKER] = slotEnvMark(project);
	return out;
}

/**
 * Env overrides for a one-off command (db:migrate, db:seed, …): the slot env
 * computed from the root .env under the process env, so the command targets
 * this project's slot database — never another checkout's.
 */
export function commandSlotEnv(root, project, env = process.env) {
	// Already resolved by a parent of THIS project (dev launcher, E2E reset →
	// `<db>-e2e`): re-applying would point the command back at the dev database.
	if (env[SLOT_ENV_MARKER] === slotEnvMark(project)) return {};
	return slotEnv(project, { ...readDotEnv(root), ...env });
}
