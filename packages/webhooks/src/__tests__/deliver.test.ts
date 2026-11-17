import type { LookupFunction } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `node:https` is faked: `request()` runs the request's own `lookup` the
 * way `net.connect` does at connect time, then answers with `net.reply`.
 * `net.requests` records what was sent and which addresses it connected to.
 */
type Reply =
	| { status: number; body?: string; location?: string }
	| { error: Error }
	| "hang";

const net = vi.hoisted(() => ({
	reply: { status: 200, body: "OK" } as Reply,
	requests: [] as {
		url: URL;
		method?: string;
		headers: Record<string, string>;
		body: string;
		connectedTo: unknown;
	}[],
}));
const lookupMock = vi.hoisted(() => vi.fn());

vi.mock("node:https", async () => {
	const { EventEmitter } = await import("node:events");
	const { Readable } = await import("node:stream");
	return {
		request: (
			url: URL,
			options: {
				method?: string;
				headers: Record<string, string>;
				lookup: LookupFunction;
			},
			onResponse: (res: unknown) => void,
		) => {
			const req = Object.assign(new EventEmitter(), {
				destroyed: false,
				destroy(err?: Error) {
					if (req.destroyed) return req;
					req.destroyed = true;
					if (err) req.emit("error", err);
					req.emit("close");
					return req;
				},
				end(body: string) {
					options.lookup(url.hostname, { all: true }, (err, addresses) => {
						if (err) {
							req.destroy(err);
							return;
						}
						net.requests.push({
							url,
							method: options.method,
							headers: options.headers,
							body,
							connectedTo: addresses,
						});
						const reply = net.reply;
						if (reply === "hang") return;
						if ("error" in reply) {
							req.destroy(reply.error);
							return;
						}
						const res = Object.assign(
							Readable.from([Buffer.from(reply.body ?? "")]),
							{
								statusCode: reply.status,
								headers: reply.location ? { location: reply.location } : {},
							},
						);
						onResponse(res);
					});
					return req;
				},
			});
			return req;
		},
	};
});

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

const PUBLIC_IP = { address: "93.184.216.34", family: 4 };

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
		net.reply = { status: 200, body: "OK" };
		net.requests = [];
		lookupMock.mockReset();
		lookupMock.mockResolvedValue([PUBLIC_IP]);
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("sends POST with correct headers and body on success", async () => {
		const result = await deliverWebhook(webhook, event);

		expect(net.requests).toHaveLength(1);
		const sent = net.requests[0];
		expect(sent?.url.href).toBe("https://example.com/webhook");
		expect(sent?.method).toBe("POST");
		expect(sent?.headers["Content-Type"]).toBe("application/json");
		expect(sent?.headers["X-Fuutu-Event"]).toBe("order.created");
		expect(sent?.headers["X-Fuutu-Event-Id"]).toBe("evt-1");
		expect(sent?.headers["User-Agent"]).toBe(
			`${KIT_NAME}-Webhook/${KIT_VERSION}`,
		);

		const timestamp = Math.floor(Date.now() / 1000);
		expect(sent?.headers["X-Fuutu-Timestamp"]).toBe(String(timestamp));
		expect(sent?.headers["X-Fuutu-Signature"]).toBe(
			signPayloadWithTimestamp("test-secret", event.payload, timestamp),
		);
		expect(sent?.headers["X-Fuutu-Signature"]).toMatch(/^t=\d+,v1=[0-9a-f]+$/);
		expect(sent?.body).toBe(JSON.stringify(event.payload));

		expect(result).toEqual({
			success: true,
			responseCode: 200,
			responseBody: "OK",
			error: null,
		});
	});

	it("connects only to the address it validated at connect time", async () => {
		await deliverWebhook(webhook, event);

		expect(net.requests[0]?.connectedTo).toEqual([PUBLIC_IP]);
	});

	it("refuses the connection when DNS flips to an internal IP after validation (rebinding)", async () => {
		lookupMock
			.mockResolvedValueOnce([PUBLIC_IP])
			.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);

		const result = await deliverWebhook(webhook, event);

		expect(result.success).toBe(false);
		expect(result.error).toContain("private/reserved IP range blocked");
		expect(net.requests).toHaveLength(0);
	});

	it("returns failure for non-ok response", async () => {
		net.reply = { status: 500, body: "Internal Server Error" };

		const result = await deliverWebhook(webhook, event);

		expect(result).toEqual({
			success: false,
			responseCode: 500,
			responseBody: "Internal Server Error",
			error: null,
		});
	});

	it("returns failure on network error", async () => {
		net.reply = { error: new Error("network error") };

		const result = await deliverWebhook(webhook, event);

		expect(result).toEqual({
			success: false,
			responseCode: null,
			responseBody: null,
			error: "network error",
		});
	});

	it("never follows redirects (SSRF via 302 → internal URL)", async () => {
		net.reply = { status: 302, location: "http://169.254.169.254/" };

		const result = await deliverWebhook(webhook, event);

		expect(result.success).toBe(false);
		expect(result.responseCode).toBe(302);
		expect(net.requests).toHaveLength(1);
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
		expect(net.requests).toHaveLength(0);
	});

	it("fails when the request exceeds the timeout", async () => {
		net.reply = "hang";

		const pending = deliverWebhook(webhook, event);
		await vi.advanceTimersByTimeAsync(10_001);
		const result = await pending;

		expect(result.success).toBe(false);
		expect(result.error).toBe("The operation timed out");
	});

	it("caps the persisted response body at maxResponseBodyBytes", async () => {
		net.reply = { status: 200, body: "x".repeat(200 * 1024) };

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
		expect(net.requests).toHaveLength(0);
	});

	it("blocks IPv4-mapped IPv6 loopback (::ffff:127.0.0.1) to prevent SSRF", async () => {
		const mappedWebhook: WebhookEndpoint = {
			...webhook,
			url: "https://[::ffff:127.0.0.1]/webhook",
		};

		const result = await deliverWebhook(mappedWebhook, event);

		expect(result.success).toBe(false);
		expect(result.error).toContain("private/reserved IP range blocked");
		expect(net.requests).toHaveLength(0);
	});

	it("blocks IPv4-mapped IPv6 loopback in hex form (::ffff:7f00:1) to prevent SSRF", async () => {
		const mappedWebhook: WebhookEndpoint = {
			...webhook,
			url: "https://[::ffff:7f00:1]/webhook",
		};

		const result = await deliverWebhook(mappedWebhook, event);

		expect(result.success).toBe(false);
		expect(result.error).toContain("private/reserved IP range blocked");
		expect(net.requests).toHaveLength(0);
	});

	it("blocks IPv4-mapped IPv6 private range in hex form (::ffff:c0a8:1 → 192.168.0.1)", async () => {
		const mappedWebhook: WebhookEndpoint = {
			...webhook,
			url: "https://[::ffff:c0a8:1]/webhook",
		};

		const result = await deliverWebhook(mappedWebhook, event);

		expect(result.success).toBe(false);
		expect(result.error).toContain("private/reserved IP range blocked");
		expect(net.requests).toHaveLength(0);
	});
});
