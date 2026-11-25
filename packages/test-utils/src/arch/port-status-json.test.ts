import { execFileSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * `--json` on `pnpm ports status` and `pnpm dev:session status`: a stable,
 * versioned object for editor tooling (the Fuutu DX extensions). Adding
 * fields is fine; removing or retyping one needs a new schemaVersion.
 */
const REPO_ROOT = join(import.meta.dirname, "../../../../");
const lib = await import("../../../../tooling/ports/index.mjs");

const idle = async () => false;
let sandbox: string;
let env: NodeJS.ProcessEnv;

function project(name: string) {
	const root = join(sandbox, name);
	mkdirSync(root, { recursive: true });
	writeFileSync(join(root, "pnpm-workspace.yaml"), "packages: []\n");
	writeFileSync(
		join(root, ".env"),
		'DATABASE_URL="postgresql://u:p@localhost:5432/acme"\n',
	);
	return root;
}

const ports = (cwd: string, ...args: string[]) =>
	execFileSync(
		process.execPath,
		[join(REPO_ROOT, "tooling/scripts/ports.mjs"), ...args],
		{ cwd, env, encoding: "utf8" },
	);

beforeEach(() => {
	sandbox = realpathSync(mkdtempSync(join(tmpdir(), "fuutu-ports-json-")));
	process.env.FUUTU_HOME = join(sandbox, ".home");
	env = { ...process.env, FUUTU_HOME: process.env.FUUTU_HOME };
});
afterEach(() => {
	delete process.env.FUUTU_HOME;
	rmSync(sandbox, { recursive: true, force: true });
});

describe("pnpm ports status --json", () => {
	it("describes this project's slot and every registered project", async () => {
		const a = project("a");
		const b = project("b");
		await lib.ensureSlot(a, { busy: idle });
		await lib.ensureSlot(b, { busy: idle });

		const status = await lib.portsStatus(a, { busy: idle });
		expect(status.schemaVersion).toBe(1);
		expect(status.root).toBe(a);
		expect(status.project).toMatchObject({
			name: "a",
			slot: 0,
			ports: lib.slotPorts(0),
			urls: {
				saas: "http://localhost:3000",
				browserCdp: "http://127.0.0.1:4099",
			},
			database: "acme",
		});
		expect(Object.values(status.project?.listening ?? {})).not.toContain(true);
		expect(status.preferredSlot).toBeNull();
		expect(status.projects.map((p) => [p.name, p.slot, p.current])).toEqual([
			["a", 0, true],
			["b", 1, false],
		]);
		expect(status.projects[1]).toMatchObject({
			path: b,
			kind: "main",
			database: "acme-s1",
			gone: null,
			stale: false,
		});
		expect(status.keptData).toEqual([]);
	});

	it("is read-only: a project without a slot gets none", async () => {
		const a = project("a");
		const status = await lib.portsStatus(a, { busy: idle });
		expect(status.project).toBeNull();
		expect(status.projects).toEqual([]);
		expect(lib.readProject(a)).toBeNull();
	});

	it("marks gone projects and kept data", async () => {
		const a = project("a");
		const b = project("b");
		await lib.ensureSlot(a, { busy: idle });
		await lib.ensureSlot(b, { busy: idle });
		rmSync(b, { recursive: true });
		const status = await lib.portsStatus(a, { busy: idle });
		expect(status.projects[1]).toMatchObject({ kind: "gone", gone: "missing" });
	});

	it("the CLI prints the same object; the human list stays text", async () => {
		const a = project("a");
		await lib.ensureSlot(a, { busy: idle });
		const json = JSON.parse(ports(a, "status", "--json"));
		expect(json).toMatchObject({ schemaVersion: 1, root: a });
		expect(json.project.slot).toBe(0);
		expect(JSON.parse(ports(a, "--json")).project.slot).toBe(0);
		expect(ports(a)).toMatch(/^a {2}slot 0 {3}\(/);
		expect(ports(a, "status")).toBe(ports(a));
	});

	it("rejects --json on commands that change state", () => {
		const a = project("a");
		expect(() => ports(a, "ensure", "--json")).toThrow();
		expect(lib.readProject(a)).toBeNull();
	});
});

describe("pnpm dev:session status --json", () => {
	it("reports every app, the database and the session browser", async () => {
		const a = project("a");
		const p = await lib.ensureSlot(a, { busy: idle });
		const up = async (port: number) => port === p.ports.saas;
		const status = await lib.sessionStatus(a, p, { busy: up });
		expect(status).toEqual({
			schemaVersion: 1,
			root: a,
			log: join(a, ".fuutu/session/dev.log"),
			project: { name: "a", slot: 0 },
			apps: [
				{
					id: "marketing",
					name: "Marketing",
					url: "http://localhost:3001",
					port: 3001,
					running: false,
				},
				{
					id: "docs",
					name: "Docs",
					url: "http://localhost:4000/docs",
					port: 4000,
					running: false,
				},
				{
					id: "saas",
					name: "SaaS",
					url: "http://localhost:3000/dashboard",
					port: 3000,
					running: true,
				},
			],
			database: { name: "acme", port: 5432, running: false },
			browser: {
				cdpUrl: "http://127.0.0.1:4099",
				port: 4099,
				running: false,
			},
		});
	});

	it("without a slot: project null, nothing running", async () => {
		const status = await lib.sessionStatus("/x", null, { busy: idle });
		expect(status).toMatchObject({
			schemaVersion: 1,
			project: null,
			apps: [],
			database: null,
			browser: null,
		});
	});

	it("the CLI prints valid JSON with schemaVersion 1", () => {
		const out = execFileSync(
			process.execPath,
			[join(REPO_ROOT, "tooling/scripts/dev-session.mjs"), "status", "--json"],
			{ cwd: REPO_ROOT, encoding: "utf8", env: { ...process.env, CI: "1" } },
		);
		expect(JSON.parse(out).schemaVersion).toBe(1);
	});

	it("parseArgs takes the caller's default command and flags", () => {
		expect(
			lib.parseArgs([], { defaultCommand: "start", knownFlags: ["--json"] }),
		).toEqual({ command: "start", arg: undefined, flags: new Set() });
		expect(() =>
			lib.parseArgs(["status", "--yes"], { knownFlags: ["--json"] }),
		).toThrow(/unknown flag --yes/);
	});
});
