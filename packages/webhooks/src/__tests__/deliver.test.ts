import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
const lookupMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

vi.mock("node:dns/promises", () => ({
	lookup: (...args: unknown[]) => lookupMock(...args),
}));

vi.mock("@fuutu/env/saas", () => ({
	env: { NODE_ENV: "test" },
}));

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

import { KIT_NAME, KIT_VERSION } from "@fuutu/config";
import { deliverWebhook } from "../deliver";
import { signPayloadWithTimestamp } from "../sign";
import type { WebhookEndpoint, WebhookEvent } from "../types";

const webhook: WebhookEndpoint = {
	id: "wh-1",
	url: "https://example.com/webhook",
	secret: "test-secret",
	events: ["order.created"],
	isActive: true,
};

const event: WebhookEvent = {
	id: "evt-1",
	type: "order.created",
	payload: { orderId: "ord-1" },
};

describe("deliverWebhook", () => {
	beforeEach(() => {
		fetchMock.mockReset();
		lookupMock.mockReset();
		lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("sends POST with correct headers and body on success", async () => {
		fetchMock.mockResolvedValue(new Response("OK", { status: 200 }));

		const result = await deliverWebhook(webhook, event);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const call = fetchMock.mock.calls[0];
		const url = call?.[0] as string;
		const init = call?.[1] as RequestInit & { headers: Record<string, string> };
		expect(url).toBe("https://example.com/webhook");
		expect(init.method).toBe("POST");
		expect(init.redirect).toBe("error");
		expect(init.headers["Content-Type"]).toBe("application/json");
		expect(init.headers["X-Fuutu-Event"]).toBe("order.created");
		expect(init.headers["X-Fuutu-Event-Id"]).toBe("evt-1");
		expect(init.headers["User-Agent"]).toBe(
			`${KIT_NAME}-Webhook/${KIT_VERSION}`,
		);

		const timestamp = Math.floor(Date.now() / 1000);
		expect(init.headers["X-Fuutu-Timestamp"]).toBe(String(timestamp));
		expect(init.headers["X-Fuutu-Signature"]).toBe(
			signPayloadWithTimestamp("test-secret", event.payload, timestamp),
		);
		expect(init.headers["X-Fuutu-Signature"]).toMatch(/^t=\d+,v1=[0-9a-f]+$/);
		expect(init.body).toBe(JSON.stringify(event.payload));

		expect(result).toEqual({
			success: true,
			responseCode: 200,
			responseBody: "OK",
			error: null,
		});
	});

	it("returns failure for non-ok response", async () => {
		fetchMock.mockResolvedValue(
			new Response("Internal Server Error", { status: 500 }),
		);

		const result = await deliverWebhook(webhook, event);

		expect(result).toEqual({
			success: false,
			responseCode: 500,
			responseBody: "Internal Server Error",
			error: null,
		});
	});

	it("returns failure on network error", async () => {
		fetchMock.mockRejectedValue(new Error("network error"));

		const result = await deliverWebhook(webhook, event);

		expect(result).toEqual({
			success: false,
			responseCode: null,
			responseBody: null,
			error: "network error",
		});
	});

	it("never follows redirects (SSRF via 302 → internal URL)", async () => {
		fetchMock.mockRejectedValue(
			new TypeError("fetch failed", { cause: "redirect" }),
		);

		const result = await deliverWebhook(webhook, event);

		const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
		expect(init.redirect).toBe("error");
		expect(result.success).toBe(false);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("blocks hostnames that resolve to a private IP (nip.io-style DNS bypass)", async () => {
		lookupMock.mockResolvedValue([{ address: "169.254.169.254", family: 4 }]);

		const nipWebhook: WebhookEndpoint = {
			...webhook,
			url: "https://169.254.169.254.nip.io/webhook",
		};

		const result = await deliverWebhook(nipWebhook, event);

		expect(result.success).toBe(false);
		expect(result.error).toContain("private/reserved IP range blocked");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("fails when the request exceeds the timeout", async () => {
		fetchMock.mockImplementation(
			(_url: string, init: RequestInit) =>
				new Promise((_resolve, reject) => {
					init.signal?.addEventListener("abort", () =>
						reject(new Error("The operation timed out")),
					);
				}),
		);

		const pending = deliverWebhook(webhook, event);
		await vi.advanceTimersByTimeAsync(10_001);
		const result = await pending;

		expect(result.success).toBe(false);
		expect(result.error).toBe("The operation timed out");
	});

	it("caps the persisted response body at maxResponseBodyBytes", async () => {
		fetchMock.mockResolvedValue(
			new Response("x".repeat(200 * 1024), { status: 200 }),
		);

		const result = await deliverWebhook(webhook, event);

		expect(result.success).toBe(true);
		expect(result.responseBody?.length).toBe(64 * 1024);
	});

	it("blocks CGNAT range 100.64.0.0/10 (RFC 6598) to prevent SSRF", async () => {
		const cgnatWebhook: WebhookEndpoint = {
			...webhook,
			url: "https://100.64.0.1/webhook",
		};

		const result = await deliverWebhook(cgnatWebhook, event);

		expect(result.success).toBe(false);
		expect(result.error).toContain("private/reserved IP range blocked");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("blocks IPv4-mapped IPv6 loopback (::ffff:127.0.0.1) to prevent SSRF", async () => {
		const mappedWebhook: WebhookEndpoint = {
			...webhook,
			url: "https://[::ffff:127.0.0.1]/webhook",
		};

		const result = await deliverWebhook(mappedWebhook, event);

		expect(result.success).toBe(false);
		expect(result.error).toContain("private/reserved IP range blocked");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("blocks IPv4-mapped IPv6 loopback in hex form (::ffff:7f00:1) to prevent SSRF", async () => {
		const mappedWebhook: WebhookEndpoint = {
			...webhook,
			url: "https://[::ffff:7f00:1]/webhook",
		};

		const result = await deliverWebhook(mappedWebhook, event);

		expect(result.success).toBe(false);
		expect(result.error).toContain("private/reserved IP range blocked");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("blocks IPv4-mapped IPv6 private range in hex form (::ffff:c0a8:1 → 192.168.0.1)", async () => {
		const mappedWebhook: WebhookEndpoint = {
			...webhook,
			url: "https://[::ffff:c0a8:1]/webhook",
		};

		const result = await deliverWebhook(mappedWebhook, event);

		expect(result.success).toBe(false);
		expect(result.error).toContain("private/reserved IP range blocked");
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
