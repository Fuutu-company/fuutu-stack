import { execFileSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const lib = await import("../../../../tooling/ports/index.mjs");

const idle = async () => false;
let sandbox: string;

/** Marks a project as a live git worktree (`.git` file → existing gitdir). */
function asWorktree(root: string) {
	const gitdir = join(sandbox, "repo/.git/worktrees", basename(root));
	mkdirSync(gitdir, { recursive: true });
	writeFileSync(join(root, ".git"), `gitdir: ${gitdir}\n`);
	return root;
}

function project(name: string, dbUrl = "postgresql://u:p@localhost:5432/acme") {
	const root = join(sandbox, name);
	mkdirSync(root, { recursive: true });
	writeFileSync(join(root, "pnpm-workspace.yaml"), "packages: []\n");
	writeFileSync(join(root, ".env"), `DATABASE_URL="${dbUrl}"\n`);
	return root;
}

beforeEach(() => {
	sandbox = mkdtempSync(join(tmpdir(), "fuutu-ports-"));
	process.env.FUUTU_HOME = join(sandbox, ".home");
});
afterEach(() => {
	delete process.env.FUUTU_HOME;
	rmSync(sandbox, { recursive: true, force: true });
});

describe("slot layout", () => {
	it("slot 0 keeps the classic ports, docs in a separate range", () => {
		expect(lib.slotPorts(0)).toEqual({
			saas: 3000,
			marketing: 3001,
			docs: 4000,
			mailPreview: 4003,
			e2eSaas: 4050,
			e2eMarketing: 4051,
			e2eDocs: 4052,
			browser: 4099,
		});
		expect(lib.slotPorts(1).saas).toBe(3100);
		expect(lib.slotPorts(1).docs).toBe(4100);
	});

	it("continues in 200-port blocks from 10000 after slot 9", () => {
		expect(lib.slotPorts(10).saas).toBe(10000);
		expect(lib.slotPorts(10).docs).toBe(10100);
		expect(lib.slotPorts(11).saas).toBe(10200);
		expect(lib.slotPorts(lib.MAX_SLOT).browser).toBeLessThan(49152);
	});

	it("skips slots whose ranges cover well-known dev ports", () => {
		expect(lib.isSlotAllowed(0)).toBe(true);
		expect(lib.isSlotAllowed(3)).toBe(false); // 3306 MySQL
		const usable = Array.from({ length: lib.MAX_SLOT + 1 }, (_, s) => s).filter(
			lib.isSlotAllowed,
		);
		expect(usable.length).toBeGreaterThan(150);
	});
});

describe("slot assignment", () => {
	it("gives every project its own slot — stopped projects keep theirs", async () => {
		const a = await lib.ensureSlot(project("a"), { busy: idle });
		const b = await lib.ensureSlot(project("b"), { busy: idle });
		expect(a.slot).toBe(0);
		expect(b.slot).toBe(1);
		// Nothing is running, yet a third project never reuses 0 or 1.
		expect((await lib.ensureSlot(project("c"), { busy: idle })).slot).toBe(2);
	});

	it("refreshes a project file written before a kit update added a port", async () => {
		const root = project("a");
		await lib.ensureSlot(project("other"), { busy: idle });
		const first = await lib.ensureSlot(root, { busy: idle });
		const file = join(root, ".fuutu", "project.json");
		const { e2eDocs: _added, ...oldPorts } = first.ports;
		writeFileSync(file, JSON.stringify({ ...first, ports: oldPorts }));
		const read = lib.readProject(root);
		expect(read?.slot).toBe(1);
		expect(read?.ports.e2eDocs).toBe(4152);
		expect(JSON.parse(readFileSync(file, "utf8")).ports.e2eDocs).toBe(4152);
		expect((await lib.ensureSlot(root, { busy: idle })).slot).toBe(1);
	});

	it("keeps the slot on every start", async () => {
		const root = project("a");
		const first = await lib.ensureSlot(root, { busy: idle });
		expect((await lib.ensureSlot(root, { busy: idle })).slot).toBe(first.slot);
	});

	it("is safe when several apps start at once", async () => {
		const roots = ["a", "b", "c", "d"].map((n) => project(n));
		const slots = await Promise.all(
			[...roots, ...roots].map((r) => lib.ensureSlot(r, { busy: idle })),
		);
		const byRoot = new Map(roots.map((r, i) => [r, slots[i]?.slot]));
		expect(new Set(byRoot.values()).size).toBe(4);
		roots.forEach((r, i) => {
			expect(slots[i + roots.length]?.slot).toBe(byRoot.get(r));
		});
	});

	it("skips a slot whose ports other software uses right now", async () => {
		const busy = async (port: number) => port === 3000;
		expect((await lib.ensureSlot(project("a"), { busy })).slot).toBe(1);
	});

	it("does not call a freshly registered project stale", async () => {
		await lib.ensureSlot(project("a"), { busy: idle, touch: false });
		expect(lib.staleProjects(lib.readRegistry())).toEqual([]);
	});

	it("frees the slot of a deleted project", async () => {
		const gone = project("gone");
		await lib.ensureSlot(gone, { busy: idle });
		rmSync(gone, { recursive: true });
		expect((await lib.ensureSlot(project("next"), { busy: idle })).slot).toBe(
			0,
		);
	});

	it("moves to a requested slot only if no other project owns it", async () => {
		const a = project("a");
		const b = asWorktree(project("b"));
		await lib.ensureSlot(a, { busy: idle });
		await lib.ensureSlot(b, { busy: idle });
		await expect(lib.setSlot(b, 0, { busy: idle })).rejects.toThrow(
			/belongs to/,
		);
		expect((await lib.setSlot(b, 5, { busy: idle })).slot).toBe(5);
		await lib.releaseSlot(b, { busy: idle });
		expect(lib.readRegistry().projects[b]).toBeUndefined();
	});

	it("derives database and auth cookie names per slot", async () => {
		await lib.ensureSlot(project("a"), { busy: idle });
		const b = await lib.ensureSlot(project("b"), { busy: idle });
		expect(b.database).toBe("acme-s1");
		expect(b.authCookiePrefix).toBe("better-auth-s1");
	});
});

describe("release and prune", () => {
	const registered = async (...names: string[]) => {
		const roots = names.map((n) => asWorktree(project(n)));
		for (const r of roots) await lib.ensureSlot(r, { busy: idle });
		return roots;
	};

	it("a released slot is reused — the lowest free slot wins", async () => {
		const [, b] = await registered("a", "b", "c");
		await lib.releaseSlot(b as string, { busy: idle });
		await lib.clearKeptData(1);
		expect((await lib.ensureSlot(project("d"), { busy: idle })).slot).toBe(1);
	});

	it("prefers slots without kept data over a lower one that kept it", async () => {
		const [, b] = await registered("a", "b", "c");
		await lib.releaseSlot(b as string, { busy: idle });
		expect(lib.readRegistry().keptData?.[1]).toMatchObject({
			path: b,
			database: "acme-s1",
		});
		const d = await lib.ensureSlot(project("d"), { busy: idle });
		expect(d.slot).toBe(4);
		expect(d.notice).toBeUndefined();
	});

	it("reuses a slot with kept data only when no clean slot is left, with a warning", async () => {
		const [, b] = await registered("a", "b");
		await lib.releaseSlot(b as string, { busy: idle });
		const keptPorts = new Set(Object.values(lib.slotPorts(1)));
		const onlyKeptFree = async (port: number) => !keptPorts.has(port);
		const d = await lib.ensureSlot(project("d"), { busy: onlyKeptFree });
		expect(d.slot).toBe(1);
		expect(d.notice).toMatch(/slot 1 still holds data kept from .*acme-s1/);
		expect(lib.readRegistry().keptData?.[1]).toBeUndefined();
	});

	it("the automatic prune on start records the deleted folder's data as kept", async () => {
		const [, gone] = await registered("a", "gone");
		rmSync(gone as string, { recursive: true });
		await lib.ensureSlot(project("next"), { busy: idle });
		expect(lib.readRegistry().keptData?.[1]?.path).toBe(gone);
	});

	it("legacy entries: matches <name>-sN(-e2e) but never a name a registered project uses", async () => {
		await registered("a", "b"); // b = slot 1, its .env says acme → acme-s1
		const other = project("other", "postgresql://u:p@localhost:5432/shop");
		await lib.setSlot(other, 7, { busy: idle });
		const names = [
			"acme",
			"acme-s1",
			"acme-s1-e2e",
			"shop-s7",
			"shop-s7-e2e",
			"fuutu-kit-s7",
			"fuutu-kit-s7-e2e",
			"fuutu-s12-e2e",
			"x-s17",
			"postgres",
		];
		expect(lib.legacySlotDatabases(7, names)).toEqual([
			"fuutu-kit-s7",
			"fuutu-kit-s7-e2e",
		]);
		expect(lib.legacySlotDatabases(12, names)).toEqual(["fuutu-s12-e2e"]);
		expect(lib.legacySlotDatabases(1, names)).toEqual([]);
		expect(lib.legacySlotDatabases(0, names)).toEqual([]);
	});

	it("excludes database names derived from a registered project's current .env", async () => {
		const [, b] = await registered("a", "b");
		writeFileSync(
			join(b as string, ".env"),
			'DATABASE_URL="postgresql://u:p@localhost:5432/renamed"\n',
		);
		const inUse = lib.databasesInUse();
		expect(inUse.has("renamed-s1")).toBe(true);
		expect(inUse.has("renamed-s1-e2e")).toBe(true);
		expect(inUse.has("acme-s1")).toBe(true);
	});

	it("records the slot database so released data can be named later", async () => {
		const [, b] = await registered("a", "b");
		expect(lib.readRegistry().projects[b as string]?.database).toBe("acme-s1");
		const released = await lib.releaseSlot(b as string, { busy: idle });
		expect(lib.slotData(released)).toEqual({
			databases: ["acme-s1", "acme-s1-e2e"],
			bucketPrefix: "s1-",
		});
	});

	it("never names data of slot 0, an unknown database or a taken slot", () => {
		const registry = {
			version: 1,
			projects: { "/x": { slot: 2, name: "x", lastStarted: null } },
		};
		expect(lib.slotData({ slot: 0, database: "acme" }, registry)).toBeNull();
		expect(lib.slotData({ slot: 2, database: "acme-s2" }, registry)).toBeNull();
		expect(lib.slotData({ slot: 1, database: null }, registry)).toEqual({
			databases: [],
			bucketPrefix: "s1-",
		});
		// A database without this slot's suffix is never a drop target.
		expect(
			lib.slotData({ slot: 1, database: "acme" }, registry)?.databases,
		).toEqual([]);
	});

	it("never releases or prunes a main checkout while its folder exists", async () => {
		await registered("a");
		const main = project("main"); // .git missing → a main checkout
		await lib.setSlot(main, 5, { busy: idle });
		const repo = project("mainrepo");
		mkdirSync(join(repo, ".git"));
		await lib.setSlot(repo, 6, { busy: idle });
		expect(lib.checkoutKind(main)).toBe("main");
		expect(lib.checkoutKind(repo)).toBe("main");
		for (const root of [main, repo]) {
			await expect(lib.releaseSlot(root, { busy: idle })).rejects.toThrow(
				/main checkout/,
			);
		}
		rmSync(join(repo, "pnpm-workspace.yaml"));
		const found = await lib.pruneRegistry({ apply: true, busy: idle });
		expect(found.map((f) => [f.path, f.kept])).toEqual([
			[repo, "main checkout"],
		]);
		expect(lib.readRegistry().projects[main]?.slot).toBe(5);
		expect(lib.readRegistry().projects[repo]?.slot).toBe(6);
	});

	it("a deleted main checkout frees its slot like any project", async () => {
		await registered("a");
		const main = project("main");
		await lib.setSlot(main, 5, { busy: idle });
		rmSync(main, { recursive: true });
		await lib.pruneRegistry({ apply: true, busy: idle });
		expect(lib.readRegistry().projects[main]).toBeUndefined();
	});

	it("refuses to release a running slot", async () => {
		const [, b] = await registered("a", "b");
		const busy = async (port: number) => port === lib.slotPorts(1).browser;
		await expect(lib.releaseSlot(b as string, { busy })).rejects.toThrow(
			/running/,
		);
		expect(lib.readRegistry().projects[b as string]?.slot).toBe(1);
	});

	it("never releases slot 0 or a pinned slot of an existing project", async () => {
		const [a, b] = await registered("a", "b");
		await expect(lib.releaseSlot(a as string, { busy: idle })).rejects.toThrow(
			/slot 0/,
		);
		writeFileSync(join(b as string, "package.json"), "{}\n");
		await lib.pinSlot(b as string, 1);
		await expect(lib.releaseSlot(b as string, { busy: idle })).rejects.toThrow(
			/pinned/,
		);
	});

	it("prune is a dry run unless applied", async () => {
		const [, gone] = await registered("a", "gone");
		rmSync(gone as string, { recursive: true });
		const found = await lib.pruneRegistry({ busy: idle });
		expect(found.map((f) => [f.path, f.reason, f.kept])).toEqual([
			[gone, "missing", null],
		]);
		expect(lib.readRegistry().projects[gone as string]).toBeDefined();
		await lib.pruneRegistry({ apply: true, busy: idle });
		expect(lib.readRegistry().projects[gone as string]).toBeUndefined();
	});

	it("prunes folders that are no longer a project or a live worktree", async () => {
		const [, plain, worktree, live] = await registered(
			"a",
			"plain",
			"worktree",
			"live",
		);
		rmSync(join(plain as string, "pnpm-workspace.yaml"));
		writeFileSync(
			join(worktree as string, ".git"),
			`gitdir: ${join(sandbox, "repo/.git/worktrees/removed")}\n`,
		);
		mkdirSync(join(sandbox, "repo/.git/worktrees/live"), { recursive: true });
		writeFileSync(
			join(live as string, ".git"),
			`gitdir: ${join(sandbox, "repo/.git/worktrees/live")}\n`,
		);
		const found = await lib.pruneRegistry({ busy: idle });
		expect(Object.fromEntries(found.map((f) => [f.path, f.reason]))).toEqual({
			[plain as string]: "not-a-project",
			[worktree as string]: "orphaned-worktree",
		});
	});

	it("keeps slot 0 while its folder exists and running slots always", async () => {
		const [zero, one] = await registered("zero", "one");
		rmSync(join(zero as string, "pnpm-workspace.yaml"));
		rmSync(one as string, { recursive: true });
		const busy = async (port: number) => port === lib.slotPorts(1).saas;
		const found = await lib.pruneRegistry({ apply: true, busy });
		expect(found.map((f) => f.kept)).toEqual(["slot 0", "running"]);
		expect(Object.keys(lib.readRegistry().projects)).toHaveLength(2);
	});

	it("start prunes only deleted folders, and never a running slot", async () => {
		const [, gone, plain, running] = await registered(
			"a",
			"gone",
			"plain",
			"running",
		);
		rmSync(gone as string, { recursive: true });
		rmSync(plain as string, { recursive: true });
		mkdirSync(plain as string);
		rmSync(running as string, { recursive: true });
		const busy = async (port: number) => port === lib.slotPorts(4).saas;
		const runningSlot = lib.readRegistry().projects[running as string]?.slot;
		expect(runningSlot).toBe(4);
		await lib.ensureSlot(project("next"), { busy });
		const paths = Object.keys(lib.readRegistry().projects);
		expect(paths).not.toContain(gone);
		expect(paths).toContain(plain);
		expect(paths).toContain(running);
	});
});

describe("local services for data drop", () => {
	it("falls back to the main checkout's .env in a worktree without one", () => {
		const main = project("main");
		writeFileSync(
			join(main, ".env"),
			'S3_ENDPOINT="http://localhost:9000"\nS3_ACCESS_KEY_ID="k"\nS3_SECRET_ACCESS_KEY="s"\n',
		);
		const wt = join(sandbox, "wt");
		mkdirSync(wt);
		const found = lib.serviceEnv(wt, "S3_ENDPOINT", {
			env: {},
			mainRoot: main,
		});
		expect(found.source).toBe(join(main, ".env"));
		expect(found.env.S3_ACCESS_KEY_ID).toBe("k");
		expect(
			lib.serviceEnv(wt, "S3_ENDPOINT", { env: {}, mainRoot: null }).env,
		).toEqual({});
	});

	it("prefers the checkout's own .env over the main checkout's", () => {
		const main = project("main");
		writeFileSync(join(main, ".env"), 'S3_ENDPOINT="http://localhost:1"\n');
		const wt = project("wt");
		writeFileSync(join(wt, ".env"), 'S3_ENDPOINT="http://localhost:2"\n');
		expect(
			lib.serviceEnv(wt, "S3_ENDPOINT", { env: {}, mainRoot: main }).env
				.S3_ENDPOINT,
		).toBe("http://localhost:2");
	});

	it("finds the main checkout of a git worktree", () => {
		const main = project("main");
		const git = (...args: string[]) =>
			execFileSync("git", args, { cwd: main, stdio: "ignore" });
		git("init", "-q");
		git(
			"-c",
			"user.email=t@t",
			"-c",
			"user.name=t",
			"commit",
			"-q",
			"--allow-empty",
			"-m",
			"init",
		);
		const wt = join(sandbox, "wt");
		git("worktree", "add", "-q", wt);
		expect(lib.mainCheckoutRoot(wt)).toBe(realpathSync(main));
		expect(lib.mainCheckoutRoot(main)).toBeNull();
	});

	it("uses S3 keys, then MINIO_ROOT_*, then the compose default", () => {
		expect(
			lib.minioCredentials({
				S3_ACCESS_KEY_ID: "a",
				S3_SECRET_ACCESS_KEY: "b",
				MINIO_ROOT_USER: "c",
				MINIO_ROOT_PASSWORD: "d",
			}).accessKeyId,
		).toBe("a");
		expect(
			lib.minioCredentials({ MINIO_ROOT_USER: "c", MINIO_ROOT_PASSWORD: "d" }),
		).toMatchObject({ accessKeyId: "c", from: "MINIO_ROOT_USER" });
		expect(lib.minioCredentials({})).toMatchObject({
			accessKeyId: "minioadmin",
			from: "compose default",
		});
	});
});

describe("preferred slot (committed, shared by the team)", () => {
	const prefer = (root: string, slot?: number) =>
		writeFileSync(
			join(root, "package.json"),
			JSON.stringify({
				name: "acme",
				...(slot === undefined ? {} : { fuutu: { preferredSlot: slot } }),
			}),
		);

	it("a fresh clone takes the preferred slot when it is free", async () => {
		const root = project("a");
		prefer(root, 4);
		const p = await lib.ensureSlot(root, { busy: idle });
		expect(p.slot).toBe(4);
		expect(p.ports.saas).toBe(3400);
	});

	it("moves an existing project to a newly pinned slot", async () => {
		const root = project("a");
		prefer(root);
		expect((await lib.ensureSlot(root, { busy: idle })).slot).toBe(0);
		prefer(root, 2);
		const moved = await lib.ensureSlot(root, { busy: idle });
		expect(moved.slot).toBe(2);
		expect(moved.notice).toMatch(/moved .*slot 0 to slot 2/);
	});

	it("keeps its own slot and says who holds the preferred one", async () => {
		const other = project("other");
		await lib.setSlot(other, 2, { busy: idle });
		const root = project("a");
		prefer(root, 2);
		const p = await lib.ensureSlot(root, { busy: idle });
		expect(p.slot).not.toBe(2);
		expect(p.notice).toContain(other);
	});

	it("does not take a preferred slot whose ports other software uses", async () => {
		const root = project("a");
		prefer(root, 2);
		const p = await lib.ensureSlot(root, {
			busy: async (port: number) => port === 3200,
		});
		expect(p.slot).not.toBe(2);
		expect(p.notice).toMatch(/in use/);
	});

	it("pin writes the slot into package.json without touching the rest", async () => {
		const root = project("a");
		prefer(root);
		await lib.ensureSlot(root, { busy: idle });
		await lib.pinSlot(root, 5);
		const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
		expect(pkg).toEqual({ name: "acme", fuutu: { preferredSlot: 5 } });
		await lib.pinSlot(root, undefined);
		expect(
			JSON.parse(readFileSync(join(root, "package.json"), "utf8")),
		).toEqual({ name: "acme" });
	});
});

describe("slot environment", () => {
	it("points local URLs, DB and buckets at the slot", async () => {
		await lib.ensureSlot(project("a"), { busy: idle });
		const p = await lib.ensureSlot(project("b"), { busy: idle });
		const env = lib.slotEnv(p, {
			BETTER_AUTH_URL: "http://localhost:3000",
			DATABASE_URL: "postgresql://u:p@localhost:5432/acme",
			S3_ENDPOINT: "http://localhost:9000",
			S3_BUCKET_AVATARS: "avatars",
		});
		expect(env).toMatchObject({
			BETTER_AUTH_URL: "http://localhost:3100",
			NEXT_PUBLIC_SAAS_URL: "http://localhost:3100",
			NEXT_PUBLIC_MARKETING_URL: "http://localhost:3101",
			NEXT_PUBLIC_DOCS_URL: "http://localhost:4100",
			CORS_ORIGIN: "http://localhost:3101",
			DATABASE_URL: "postgresql://u:p@localhost:5432/acme-s1",
			S3_BUCKET_AVATARS: "s1-avatars",
			FUUTU_AUTH_COOKIE_PREFIX: "better-auth-s1",
		});
	});

	it("never touches explicit remote values", async () => {
		const p = await lib.ensureSlot(project("a"), { busy: idle });
		const env = lib.slotEnv(p, {
			BETTER_AUTH_URL: "https://my-tunnel.example.com",
			DATABASE_URL: "postgresql://u:p@db.example.com:5432/prod",
		});
		expect(env.BETTER_AUTH_URL).toBeUndefined();
		expect(env.DATABASE_URL).toBeUndefined();
	});

	it("treats only localhost / 127.0.0.1 as local (guards the E2E database reset)", () => {
		expect(lib.isLocal("postgresql://u:p@localhost:5432/acme-e2e")).toBe(true);
		expect(lib.isLocal("postgresql://u:p@127.0.0.1:5432/acme-e2e")).toBe(true);
		expect(lib.isLocal("postgresql://u:p@db.example.com:5432/acme-e2e")).toBe(
			false,
		);
		expect(lib.isLocal("postgresql://u:p@postgres:5432/acme-e2e")).toBe(false);
		expect(
			lib.isLocal("postgresql://u:p@localhost.evil.com:5432/acme-e2e"),
		).toBe(false);
	});

	it("judges the parsed host, not a username that looks like one", () => {
		expect(
			lib.isLocal("postgresql://localhost:5432@db.prod.example.com/app"),
		).toBe(false);
		expect(lib.isLocal("http://localhost@evil.example.com/")).toBe(false);
		expect(lib.isLocal("http://127.0.0.1.evil.example.com/")).toBe(false);
		expect(lib.isLocal("postgresql://u:p@[::1]:5432/acme-e2e")).toBe(true);
		expect(lib.isLocal("http://[::1]:3000")).toBe(true);
		expect(lib.isLocal("http://LOCALHOST:3000")).toBe(true);
		expect(lib.isLocal("not a url")).toBe(false);
		expect(lib.isLocal("localhost:5432")).toBe(false);
		expect(lib.isLocal(undefined)).toBe(true);
		expect(lib.isLocal("")).toBe(true);
	});

	it("resets only the slot's own local <database>-e2e", async () => {
		const p = await lib.ensureSlot(project("a"), { busy: idle });
		const target = `postgresql://u:p@localhost:5432/${p.database}-e2e`;
		expect(lib.isE2eResetTarget(target, p)).toBe(true);
		expect(
			lib.isE2eResetTarget(`postgresql://u:p@[::1]:5432/${p.database}-e2e`, p),
		).toBe(true);
		expect(
			lib.isE2eResetTarget(`postgresql://u:p@localhost:5432/${p.database}`, p),
		).toBe(false);
		expect(
			lib.isE2eResetTarget("postgresql://u:p@localhost:5432/other-e2e", p),
		).toBe(false);
		expect(
			lib.isE2eResetTarget(
				`postgresql://localhost:5432@db.prod.example.com/${p.database}-e2e`,
				p,
			),
		).toBe(false);
		expect(lib.isE2eResetTarget(undefined, p)).toBe(false);
		expect(lib.isE2eResetTarget("", p)).toBe(false);
	});

	it("gives E2E servers their own database, never the dev session's", async () => {
		const p = await lib.ensureSlot(project("a"), { busy: idle });
		const env = lib.slotEnv(
			p,
			{ DATABASE_URL: "postgresql://u:p@localhost:5432/acme" },
			{ e2e: true },
		);
		expect(env.DATABASE_URL).toBe("postgresql://u:p@localhost:5432/acme-e2e");
	});

	it("uses the E2E ports for E2E servers", async () => {
		const p = await lib.ensureSlot(project("a"), { busy: idle });
		const env = lib.slotEnv(p, {}, { e2e: true });
		expect(env.BETTER_AUTH_URL).toBe("http://localhost:4050");
		expect(env.NEXT_PUBLIC_MARKETING_URL).toBe("http://localhost:4051");
		expect(env.NEXT_PUBLIC_DOCS_URL).toBe("http://localhost:4052");
		expect(lib.slotEnv(p, {}).NEXT_PUBLIC_DOCS_URL).toBe(
			"http://localhost:4000",
		);
	});
});

describe("db command environment", () => {
	it("points the root .env's local database at the slot", async () => {
		await lib.ensureSlot(project("a"), { busy: idle });
		const root = project("b");
		const p = await lib.ensureSlot(root, { busy: idle });
		expect(lib.commandSlotEnv(root, p, {}).DATABASE_URL).toBe(
			"postgresql://u:p@localhost:5432/acme-s1",
		);
	});

	it("leaves slot 0 on the unsuffixed database", async () => {
		const root = project("a");
		const p = await lib.ensureSlot(root, { busy: idle });
		expect(lib.commandSlotEnv(root, p, {}).DATABASE_URL).toBe(
			"postgresql://u:p@localhost:5432/acme",
		);
	});

	it("never rewrites a remote database from .env or the process env", async () => {
		await lib.ensureSlot(project("a"), { busy: idle });
		const root = project("b", "postgresql://u:p@db.example.com:5432/prod");
		const p = await lib.ensureSlot(root, { busy: idle });
		expect(lib.commandSlotEnv(root, p, {}).DATABASE_URL).toBeUndefined();
		expect(
			lib.commandSlotEnv(root, p, {
				DATABASE_URL: "postgresql://u:p@postgres:5432/fuutu-stack",
			}).DATABASE_URL,
		).toBeUndefined();
	});

	it("leaves an env that already carries the slot env untouched (E2E seed on <db>-e2e)", async () => {
		await lib.ensureSlot(project("a"), { busy: idle });
		const root = project("b");
		const p = await lib.ensureSlot(root, { busy: idle });
		const e2e = lib.slotEnv(
			p,
			{ DATABASE_URL: "postgresql://u:p@localhost:5432/acme" },
			{ e2e: true },
		);
		expect(e2e[lib.SLOT_ENV_MARKER]).toBe(`1:${root}`);
		expect(lib.commandSlotEnv(root, p, { ...e2e })).toEqual({});
	});

	it("re-resolves a slot env inherited from another checkout", async () => {
		const main = project("main");
		const mainProject = await lib.ensureSlot(main, { busy: idle });
		const root = project("worktree");
		const p = await lib.ensureSlot(root, { busy: idle });
		// A shell spawned by the main checkout's dev session or E2E run.
		const inherited = {
			...lib.slotEnv(mainProject, {
				DATABASE_URL: "postgresql://u:p@localhost:5432/acme",
			}),
		};
		expect(lib.commandSlotEnv(root, p, inherited).DATABASE_URL).toBe(
			"postgresql://u:p@localhost:5432/acme-s1",
		);
	});

	it("follows .env once it appears after the slot was taken", async () => {
		await lib.ensureSlot(project("a"), { busy: idle });
		const root = join(sandbox, "fresh");
		mkdirSync(root);
		writeFileSync(join(root, "pnpm-workspace.yaml"), "packages: []\n");
		const first = await lib.ensureSlot(root, { busy: idle });
		expect(first.database).toBe("fuutu-s1");
		writeFileSync(
			join(root, ".env"),
			'DATABASE_URL="postgresql://u:p@localhost:5432/acme"\n',
		);
		const p = lib.readProject(root);
		expect(p?.database).toBe("acme-s1");
		expect(lib.commandSlotEnv(root, p as never, {}).DATABASE_URL).toBe(
			"postgresql://u:p@localhost:5432/acme-s1",
		);
	});

	it("lets the process env win over .env", async () => {
		await lib.ensureSlot(project("a"), { busy: idle });
		const root = project("b");
		const p = await lib.ensureSlot(root, { busy: idle });
		expect(
			lib.commandSlotEnv(root, p, {
				DATABASE_URL: "postgresql://u:p@127.0.0.1:5433/other",
			}).DATABASE_URL,
		).toBe("postgresql://u:p@127.0.0.1:5433/acme-s1");
	});
});
