import { describe, expect, it, vi } from "vitest";

// A thrown handler error must reach the log with name and message:
// an Error passed as-is serialized to `{}` and hid the cause.
const logError = vi.hoisted(() => vi.fn());
vi.mock("@fuutu/logs", async (importOriginal) => ({
	...(await importOriginal<typeof import("@fuutu/logs")>()),
	createLogger: () => ({
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: logError,
	}),
}));
vi.mock("@fuutu/auth", () => ({
	auth: {
		handler: vi.fn(async () => {
			throw new TypeError("Cannot read private member #state");
		}),
	},
}));
vi.mock("@fuutu/cron", () => ({ runAllJobs: vi.fn(), runJob: vi.fn() }));
vi.mock("@fuutu/license", () => ({
	checkLicense: vi.fn(async () => ({})),
	getLicenseMode: vi.fn(() => "oss"),
}));
vi.mock("@fuutu/telemetry", () => ({ pingTelemetry: vi.fn(async () => ({})) }));
vi.mock("@fuutu/payments", () => ({ handlePaymentsWebhook: vi.fn() }));
vi.mock("../mcp", () => ({ handleMcpRequest: vi.fn() }));

const { app } = await import("../app");

describe("app.onError", () => {
	it("logs the error's name and message and answers a generic 500", async () => {
		const res = await app.request("/api/auth/get-session");
		expect(res.status).toBe(500);
		expect(await res.json()).toEqual({ error: "internal_error" });

		const call = logError.mock.calls.find(([msg]) => msg === "unhandled error");
		expect(call?.[1]).toMatchObject({
			err: {
				name: "TypeError",
				message: "Cannot read private member #state",
			},
			path: "/api/auth/get-session",
		});
		expect(JSON.parse(JSON.stringify(call?.[1])).err.message).toBe(
			"Cannot read private member #state",
		);
	});
});
