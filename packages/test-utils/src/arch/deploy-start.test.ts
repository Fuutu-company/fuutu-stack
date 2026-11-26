import { spawn } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Deploy images (Railpack) ship only `node` — no curl or wget — and no
 * Prisma CLI in `.next/standalone`. `tooling/deploy/` fills both gaps:
 * `start-with-migrate.mjs` migrates before the server starts (fail-fast,
 * `MIGRATE_ON_START=0` opt-out), `healthcheck.mjs` and `cron.mjs` replace
 * curl. These tests run the scripts as the container would.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const DEPLOY = join(REPO_ROOT, "tooling/deploy");

type Run = { code: number | null; stdout: string; stderr: string };

function run(
	script: string,
	args: string[],
	env: Record<string, string | undefined>,
): Promise<Run> {
	return new Promise((resolve) => {
		// Only PATH from the parent: the scripts must not pick up the test
		// runner's PORT, CRON_SECRET or MIGRATE_ON_START.
		const childEnv: NodeJS.ProcessEnv = { NODE_ENV: "test" };
		for (const [key, value] of Object.entries({
			PATH: process.env.PATH,
			...env,
		})) {
			if (value !== undefined) childEnv[key] = value;
		}
		const child = spawn(process.execPath, [join(DEPLOY, script), ...args], {
			env: childEnv,
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (d: Buffer) => {
			stdout += d;
		});
		child.stderr.on("data", (d: Buffer) => {
			stderr += d;
		});
		child.on("close", (code: number | null) =>
			resolve({ code, stdout, stderr }),
		);
	});
}

const sandbox = realpathSync(mkdtempSync(join(tmpdir(), "deploy-start-")));
afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

describe("healthcheck.mjs", () => {
	let server: Server;
	let port: string;
	const seen: string[] = [];

	beforeAll(async () => {
		server = createServer((req, res) => {
			seen.push(req.url ?? "");
			const status = Number(req.url?.split("/status/")[1] ?? 200);
			res.writeHead(status).end();
		});
		await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
		port = String((server.address() as AddressInfo).port);
	});
	afterAll(() => new Promise<void>((r) => server.close(() => r())));

	it.each([
		["/status/200", 0],
		["/status/307", 0],
		["/status/404", 0],
		["/status/499", 0],
		["/status/500", 1],
		["/status/503", 1],
	])("GET %s exits %i", async (path, expected) => {
		const { code } = await run("healthcheck.mjs", [path], { PORT: port });
		expect(code).toBe(expected);
	});

	it("defaults to / on $PORT", async () => {
		seen.length = 0;
		const { code } = await run("healthcheck.mjs", [], { PORT: port });
		expect(code).toBe(0);
		expect(seen).toEqual(["/"]);
	});

	it("exits 1 when nothing listens", async () => {
		const closed = createServer();
		await new Promise<void>((r) => closed.listen(0, "127.0.0.1", r));
		const free = String((closed.address() as AddressInfo).port);
		await new Promise<void>((r) => closed.close(() => r()));
		const { code } = await run("healthcheck.mjs", ["/"], { PORT: free });
		expect(code).toBe(1);
	});
});

describe("cron.mjs", () => {
	let server: Server;
	let port: string;
	const SECRET = "test-cron-secret";

	beforeAll(async () => {
		server = createServer((req, res) => {
			const ok =
				req.method === "POST" &&
				req.url === "/api/cron" &&
				req.headers.authorization === `Bearer ${SECRET}`;
			res.writeHead(ok ? 200 : 401).end();
		});
		await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
		port = String((server.address() as AddressInfo).port);
	});
	afterAll(() => new Promise<void>((r) => server.close(() => r())));

	it("POSTs /api/cron with the bearer secret and exits 0", async () => {
		const { code } = await run("cron.mjs", [], {
			PORT: port,
			CRON_SECRET: SECRET,
		});
		expect(code).toBe(0);
	});

	it("exits 1 on a rejected secret", async () => {
		const { code } = await run("cron.mjs", [], {
			PORT: port,
			CRON_SECRET: "wrong",
		});
		expect(code).toBe(1);
	});

	it("exits 1 without CRON_SECRET", async () => {
		const { code, stderr } = await run("cron.mjs", [], { PORT: port });
		expect(code).toBe(1);
		expect(stderr).toMatch(/CRON_SECRET/);
	});
});

describe("start-with-migrate.mjs", () => {
	// A stand-in bundle: the "CLI" records its argv and exits with
	// $FAKE_MIGRATE_EXIT; the "server" records that it started.
	const migrateDir = join(sandbox, "migrate");
	const cliDir = join(migrateDir, "node_modules/prisma/build");
	const serverJs = join(sandbox, "server.cjs");
	const migrateMark = join(sandbox, "migrate.mark");
	const serverMark = join(sandbox, "server.mark");

	beforeAll(() => {
		mkdirSync(cliDir, { recursive: true });
		writeFileSync(
			join(cliDir, "index.js"),
			`require("node:fs").writeFileSync(${JSON.stringify(migrateMark)}, process.argv.slice(2).join(" ") + "|" + process.cwd());
process.exit(Number(process.env.FAKE_MIGRATE_EXIT ?? 0));`,
		);
		writeFileSync(
			serverJs,
			`require("node:fs").writeFileSync(${JSON.stringify(serverMark)}, "up");`,
		);
	});

	const start = (env: Record<string, string | undefined>) => {
		rmSync(migrateMark, { force: true });
		rmSync(serverMark, { force: true });
		return run("start-with-migrate.mjs", [migrateDir, serverJs], env);
	};

	it("runs `prisma migrate deploy` in the bundle, then the server", async () => {
		const { code } = await start({});
		expect(code).toBe(0);
		expect(readFileSync(migrateMark, "utf8")).toBe(
			`migrate deploy|${migrateDir}`,
		);
		expect(existsSync(serverMark)).toBe(true);
	});

	it.each(["1", "true", ""])("migrates with MIGRATE_ON_START=%j", async (v) => {
		const { code } = await start({ MIGRATE_ON_START: v });
		expect(code).toBe(0);
		expect(existsSync(migrateMark)).toBe(true);
		expect(existsSync(serverMark)).toBe(true);
	});

	it("exits with the migration's code and never starts the server", async () => {
		const { code, stderr } = await start({ FAKE_MIGRATE_EXIT: "3" });
		expect(code).toBe(3);
		expect(stderr).toMatch(/migration failed/);
		expect(existsSync(serverMark)).toBe(false);
	});

	it.each(["0", "false"])(
		"MIGRATE_ON_START=%s skips the migration",
		async (v) => {
			const { code } = await start({ MIGRATE_ON_START: v });
			expect(code).toBe(0);
			expect(existsSync(migrateMark)).toBe(false);
			expect(existsSync(serverMark)).toBe(true);
		},
	);

	it.each(["yes", "off", "toString"])(
		"MIGRATE_ON_START=%s stops the start",
		async (v) => {
			const { code } = await start({ MIGRATE_ON_START: v });
			expect(code).toBe(1);
			expect(existsSync(migrateMark)).toBe(false);
			expect(existsSync(serverMark)).toBe(false);
		},
	);

	it("fails when the bundle has no CLI", async () => {
		rmSync(serverMark, { force: true });
		const { code } = await run(
			"start-with-migrate.mjs",
			[join(sandbox, "missing"), serverJs],
			{},
		);
		expect(code).toBe(1);
		expect(existsSync(serverMark)).toBe(false);
	});
});

type RailpackConfig = {
	steps: Record<string, { commands?: string[] }>;
	deploy: {
		inputs: { step?: string; include?: string[] }[];
		startCommand: string;
	};
};

const railpack = (app: string) =>
	JSON.parse(
		readFileSync(join(REPO_ROOT, "apps", app, "railpack.json"), "utf8"),
	) as RailpackConfig;

describe("Railpack deploy images", () => {
	for (const app of ["saas", "marketing", "docs"]) {
		it(`apps/${app} ships tooling/deploy (healthcheck without curl)`, () => {
			const includes = railpack(app).deploy.inputs.flatMap(
				(i) => i.include ?? [],
			);
			expect(includes).toContain("tooling/deploy");
		});
	}

	it("apps/saas bundles the migrations and migrates on start", () => {
		const config = railpack("saas");
		const commands = config.steps.build?.commands ?? [];
		const build = commands.findIndex((c) =>
			c.includes("--filter @fuutu/saas build"),
		);
		const bundle = commands.findIndex((c) =>
			c.startsWith(
				"node tooling/deploy/bundle-migrate.mjs apps/saas/.next/standalone/",
			),
		);
		expect(build).toBeGreaterThanOrEqual(0);
		expect(bundle).toBeGreaterThan(build);
		const out = commands[bundle]?.split(" ")[2];
		expect(config.deploy.startCommand).toBe(
			`node tooling/deploy/start-with-migrate.mjs ${out} apps/saas/.next/standalone/apps/saas/server.js`,
		);
	});
});

/**
 * The docs app reads its OpenAPI spec by path and loads evlog through a
 * non-literal import(): neither is visible to the standalone tracer, and
 * without them `/` and `/docs` answer 500 in a deploy image.
 */
describe("docs standalone output", () => {
	it("traces the OpenAPI spec and evlog", () => {
		const source = readFileSync(
			join(REPO_ROOT, "apps/docs/next.config.ts"),
			"utf8",
		);
		const includes = source.match(/outputFileTracingIncludes:\s*{[^}]*}/)?.[0];
		expect(includes).toBeDefined();
		expect(includes).toContain("./content/openapi/");
		expect(includes).toContain("./node_modules/evlog/");
		const spec = readFileSync(
			join(REPO_ROOT, "apps/docs/src/lib/openapi.ts"),
			"utf8",
		).match(/"\.\/(content\/openapi\/[^"]+)"/)?.[1];
		expect(spec && existsSync(join(REPO_ROOT, "apps/docs", spec))).toBe(true);
	});
});
