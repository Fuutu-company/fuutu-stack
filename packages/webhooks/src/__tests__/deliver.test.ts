import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

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
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("sends POST with correct headers and body on success", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			text: () => Promise.resolve("OK"),
		});

		const result = await deliverWebhook(webhook, event);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const call = fetchMock.mock.calls[0];
		const url = call?.[0] as string;
		const init = call?.[1] as RequestInit & { headers: Record<string, string> };
		expect(url).toBe("https://example.com/webhook");
		expect(init.method).toBe("POST");
		expect(init.headers["Content-Type"]).toBe("application/json");
		expect(init.headers["X-Fuutu-Event"]).toBe("order.created");

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
		fetchMock.mockResolvedValue({
			ok: false,
			status: 500,
			text: () => Promise.resolve("Internal Server Error"),
		});

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
