import {
	KIT_FINGERPRINT_HEADER_NAME,
	KIT_FINGERPRINT_HEADER_VALUE,
} from "@fuutu/config";
import { beforeEach, describe, expect, it, vi } from "vitest";

// app.ts boot side effects and heavy routers are stubbed — this suite only
// checks where app-owned routes sit in the middleware chain.
vi.mock("@fuutu/auth", () => ({
	auth: { handler: vi.fn(async () => new Response("auth")) },
}));
vi.mock("@fuutu/cron", () => ({ runAllJobs: vi.fn(), runJob: vi.fn() }));
vi.mock("@fuutu/license", () => ({
	checkLicense: vi.fn(async () => ({})),
	getLicenseMode: vi.fn(() => "oss"),
}));
vi.mock("@fuutu/telemetry", () => ({ pingTelemetry: vi.fn(async () => ({})) }));
vi.mock("@fuutu/payments", () => ({ handlePaymentsWebhook: vi.fn() }));
vi.mock("../mcp", () => ({ handleMcpRequest: vi.fn() }));
vi.mock("../orpc/handler", () => {
	const unmatched = {
		handle: vi.fn(async () => ({ matched: false, response: undefined })),
	};
	return { rpcHandler: unmatched, openApiHandler: unmatched };
});
vi.mock("../context", () => ({
	API_KEY_HEADER: "x-api-key",
	createContext: vi.fn(async () => ({
		session: null,
		headers: new Headers(),
		apiKey: null,
	})),
}));
vi.mock("../custom-routes", () => ({
	mountCustomRoutes: (app: {
		get: (path: string, handler: () => Response) => unknown;
	}) => {
		app.get("/custom/ping", () => Response.json({ pong: true }));
		// Deliberately on a path an oRPC/REST procedure owns (GET /webhooks).
		app.get("/webhooks", () => Response.json({ shadowed: true }));
	},
}));

const { app } = await import("../app");
const { createContext } = await import("../context");
const { openApiHandler } = await import("../orpc/handler");

describe("mountCustomRoutes", () => {
	beforeEach(() => {
		vi.mocked(createContext).mockClear();
	});

	it("serves app routes under /api before the session context is built", async () => {
		const res = await app.request("/api/custom/ping");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ pong: true });
		expect(createContext).not.toHaveBeenCalled();
	});

	it("keeps the kit middleware (fingerprint header) on app routes", async () => {
		const res = await app.request("/api/custom/ping");
		expect(res.headers.get(KIT_FINGERPRINT_HEADER_NAME)).toBe(
			KIT_FINGERPRINT_HEADER_VALUE,
		);
	});

	it("shadows a procedure-owned path — the procedure (and authProcedure) never runs", async () => {
		vi.mocked(openApiHandler.handle).mockClear();
		const res = await app.request("/api/webhooks");
		expect(await res.json()).toEqual({ shadowed: true });
		expect(openApiHandler.handle).not.toHaveBeenCalled();
		expect(createContext).not.toHaveBeenCalled();
	});

	it("still routes everything else through createContext", async () => {
		await app.request("/api/unknown-route");
		expect(createContext).toHaveBeenCalledTimes(1);
	});
});
