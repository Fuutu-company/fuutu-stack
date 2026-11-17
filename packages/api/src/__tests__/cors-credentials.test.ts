// Loads the full module inside a hook or test: slow on a busy machine.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

/**
 * CORS_ORIGIN (e.g. the marketing site) gets plain CORS only: no
 * credentialed responses and no CSRF-guard trust — script on that origin
 * must not act as the signed-in user. `CORS_CREDENTIALS=1` opts back in.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/auth", () => ({
	auth: { api: {}, handler: vi.fn(async () => new Response("auth")) },
}));
vi.mock("@fuutu/ai", () => ({ resolveAIProvider: vi.fn() }));
vi.mock("@fuutu/cron", () => ({ runAllJobs: vi.fn(), runJob: vi.fn() }));
vi.mock("@fuutu/license", () => ({
	checkLicense: vi.fn(async () => ({})),
	getLicenseMode: vi.fn(() => "oss"),
}));
vi.mock("@fuutu/telemetry", () => ({ pingTelemetry: vi.fn(async () => ({})) }));
vi.mock("../mcp", () => ({
	handleMcpRequest: vi.fn(async () => new Response("ok")),
}));

const MARKETING = "https://example.com";

async function loadApp(credentials: string | undefined) {
	vi.resetModules();
	vi.stubEnv("CORS_ORIGIN", MARKETING);
	if (credentials === undefined) vi.stubEnv("CORS_CREDENTIALS", undefined);
	else vi.stubEnv("CORS_CREDENTIALS", credentials);
	return (await import("../app")).app;
}

afterEach(() => {
	vi.unstubAllEnvs();
});

const preflight = {
	method: "OPTIONS",
	headers: {
		origin: MARKETING,
		"access-control-request-method": "POST",
		"access-control-request-headers": "content-type",
	},
};

const crossSitePost = {
	method: "POST",
	headers: { origin: MARKETING, "content-type": "application/json" },
	body: "{}",
};

describe("CORS by default (CORS_CREDENTIALS unset)", () => {
	it("allows the origin without credentials", async () => {
		const app = await loadApp(undefined);
		const res = await app.request("/api/rpc/users/me", preflight);
		expect(res.headers.get("access-control-allow-origin")).toBe(MARKETING);
		expect(res.headers.get("access-control-allow-credentials")).toBeNull();
	});

	it("does not trust CORS_ORIGIN in the CSRF origin guard", async () => {
		const app = await loadApp(undefined);
		const res = await app.request("/api/auth/sign-out", crossSitePost);
		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({ error: "forbidden_origin" });
	});

	it("still lets the app's own origin through the guard", async () => {
		const app = await loadApp(undefined);
		const res = await app.request("/api/auth/sign-out", {
			...crossSitePost,
			headers: { ...crossSitePost.headers, origin: "http://localhost:3000" },
		});
		expect(res.status).toBe(200);
	});
});

describe("CORS_CREDENTIALS=1 (explicit opt-in)", () => {
	it("sends credentialed CORS and trusts CORS_ORIGIN in the guard", async () => {
		const app = await loadApp("1");
		const pre = await app.request("/api/rpc/users/me", preflight);
		expect(pre.headers.get("access-control-allow-credentials")).toBe("true");
		const res = await app.request("/api/auth/sign-out", crossSitePost);
		expect(res.status).toBe(200);
	});
});
