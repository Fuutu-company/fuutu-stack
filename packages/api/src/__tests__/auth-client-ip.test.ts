import { CLIENT_IP_HEADER } from "@fuutu/auth/client-ip-header";
import { beforeEach, describe, expect, it, vi } from "vitest";

// app.ts boot side effects are stubbed — this suite only checks which
// client IP the Better Auth handler receives.
vi.mock("@fuutu/auth", () => ({
	auth: { handler: vi.fn(async () => new Response("auth")) },
}));
vi.mock("../client-ip", () => ({ getClientIp: vi.fn(() => null) }));
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

const { app } = await import("../app");
const { auth } = await import("@fuutu/auth");
const { getClientIp } = await import("../client-ip");

function forwardedRequest(): Request {
	const handler = vi.mocked(auth.handler);
	const request = handler.mock.calls.at(-1)?.[0];
	if (!request) throw new Error("auth.handler was not called");
	return request;
}

const signIn = () =>
	app.request("/api/auth/sign-in/email", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			[CLIENT_IP_HEADER]: "6.6.6.6",
			"x-forwarded-for": "6.6.6.6",
		},
		body: "{}",
	});

describe("/auth/** client IP", () => {
	beforeEach(() => {
		vi.mocked(auth.handler).mockClear();
	});

	it("never passes a client-sent IP header on without trusted proxy headers", async () => {
		vi.mocked(getClientIp).mockReturnValue(null);
		await signIn();
		expect(forwardedRequest().headers.has(CLIENT_IP_HEADER)).toBe(false);
	});

	it("replaces it with the kit's trusted client IP", async () => {
		vi.mocked(getClientIp).mockReturnValue("203.0.113.7");
		await signIn();
		expect(forwardedRequest().headers.get(CLIENT_IP_HEADER)).toBe(
			"203.0.113.7",
		);
	});
});
