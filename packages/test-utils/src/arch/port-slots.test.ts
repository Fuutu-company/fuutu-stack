import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const lib = await import("../../../../tooling/ports/index.mjs");

const idle = async () => false;
let sandbox: string;

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
		const b = project("b");
		await lib.ensureSlot(a, { busy: idle });
		await lib.ensureSlot(b, { busy: idle });
		await expect(lib.setSlot(b, 0, { busy: idle })).rejects.toThrow(
			/belongs to/,
		);
		expect((await lib.setSlot(b, 5, { busy: idle })).slot).toBe(5);
		await lib.releaseSlot(b);
		expect(lib.readRegistry().projects[b]).toBeUndefined();
	});

	it("derives database and auth cookie names per slot", async () => {
		await lib.ensureSlot(project("a"), { busy: idle });
		const b = await lib.ensureSlot(project("b"), { busy: idle });
		expect(b.database).toBe("acme-s1");
		expect(b.authCookiePrefix).toBe("better-auth-s1");
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

	it("uses the E2E ports for E2E servers", async () => {
		const p = await lib.ensureSlot(project("a"), { busy: idle });
		expect(lib.slotEnv(p, {}, { e2e: true }).BETTER_AUTH_URL).toBe(
			"http://localhost:4050",
		);
	});
});
