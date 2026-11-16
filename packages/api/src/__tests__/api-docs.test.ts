import { OpenAPIGenerator } from "@orpc/openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `/api/docs` and `/api/spec.json` are public: the merged spec is built
 * once per process (a failed Better Auth spec fetch is not retried per
 * request, and production — Better Auth's OpenAPI plugin off — never
 * fetches it), responses are cacheable, and each client IP is limited.
 */

const nodeEnv = vi.hoisted(() => ({ value: "test" }));

vi.mock("@fuutu/env/saas", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@fuutu/env/saas")>();
	return {
		...actual,
		env: new Proxy(actual.env, {
			get(target, prop, receiver) {
				if (prop === "NODE_ENV") return nodeEnv.value;
				if (prop === "TRUST_PROXY_HEADERS") return true;
				return Reflect.get(target, prop, receiver);
			},
		}),
	};
});

vi.mock("@fuutu/auth", () => ({
	auth: {
		api: {},
		handler: vi.fn(async () =>
			Response.json({ paths: { "/get-session": { get: {} } } }),
		),
	},
}));
vi.mock("@fuutu/ai", () => ({ resolveAIProvider: vi.fn() }));
vi.mock("@fuutu/cron", () => ({ runAllJobs: vi.fn(), runJob: vi.fn() }));
vi.mock("@fuutu/license", () => ({
	checkLicense: vi.fn(async () => ({})),
	getLicenseMode: vi.fn(() => "oss"),
}));
vi.mock("@fuutu/telemetry", () => ({ pingTelemetry: vi.fn(async () => ({})) }));

type App = typeof import("../app")["app"];

let app: App;
let authHandler: ReturnType<typeof vi.fn>;
let ipCounter = 0;
type Spec = { paths: Record<string, unknown> };
/** A fresh client IP per request unless one is given. */
const get = (path: string, ip = `10.0.0.${++ipCounter}`) =>
	app.request(path, { headers: { "x-forwarded-for": ip } });

async function loadApp() {
	vi.resetModules();
	({ app } = await import("../app"));
	const { auth } = await import("@fuutu/auth");
	authHandler = vi.mocked(auth.handler);
	authHandler.mockClear();
}

beforeEach(async () => {
	nodeEnv.value = "test";
	await loadApp();
});

describe("API docs (/api/docs, /api/spec.json)", () => {
	it("builds the merged spec once per process", async () => {
		const generate = vi.spyOn(OpenAPIGenerator.prototype, "generate");
		const { router } = await import("../orpc/router");
		const first = await ((await get("/api/spec.json")).json() as Promise<Spec>);
		for (let i = 0; i < 3; i++) {
			await get("/api/spec.json");
			await get("/api/docs");
		}
		expect(Object.keys(first.paths)).toContain("/auth/get-session");
		expect(Object.keys(first.paths)).toContain("/payments/portal");
		const routerBuilds = generate.mock.calls.filter(
			([target]) => target === router,
		);
		expect(routerBuilds).toHaveLength(1);
		expect(authHandler).toHaveBeenCalledTimes(1);
		generate.mockRestore();
	});

	it("does not retry a failed Better Auth spec fetch per request", async () => {
		authHandler.mockResolvedValueOnce(new Response("boom", { status: 500 }));
		const spec = await ((await get("/api/spec.json")).json() as Promise<Spec>);
		await get("/api/spec.json");
		await get("/api/docs");
		expect(Object.keys(spec.paths)).not.toContain("/auth/get-session");
		expect(authHandler).toHaveBeenCalledTimes(1);
	});

	it("skips the Better Auth spec in production (its OpenAPI plugin is off)", async () => {
		nodeEnv.value = "production";
		await loadApp();
		const res = await get("/api/spec.json");
		expect(res.status).toBe(200);
		expect(authHandler).not.toHaveBeenCalled();
	});

	it("serves the reference UI and the spec as cacheable responses", async () => {
		const docs = await get("/api/docs");
		expect(docs.status).toBe(200);
		expect(docs.headers.get("content-type")).toContain("text/html");
		expect(docs.headers.get("cache-control")).toBe("public, max-age=300");
		const spec = await get("/api/spec.json");
		expect(spec.headers.get("content-type")).toContain("application/json");
		expect(spec.headers.get("cache-control")).toBe("public, max-age=300");
	});

	it("rate-limits each client IP", async () => {
		const { apiConfig } = await import("../config");
		const { maxRequests } = apiConfig.rateLimit.endpoints.apiDocs;
		const ip = "203.0.113.7";
		for (let i = 0; i < maxRequests; i++) {
			expect((await get("/api/spec.json", ip)).status).toBe(200);
		}
		const limited = await get("/api/docs", ip);
		expect(limited.status).toBe(429);
		expect(limited.headers.get("retry-after")).toBeTruthy();
		expect((await get("/api/docs", "203.0.113.8")).status).toBe(200);
	});
});
