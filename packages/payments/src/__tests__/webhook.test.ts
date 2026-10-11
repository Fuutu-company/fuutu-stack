import { beforeEach, describe, expect, it, vi } from "vitest";

const mockParseWebhook = vi.fn();
const mockProcessWebhookEvents = vi.fn();

vi.mock("../resolve", () => ({
	resolvePaymentProvider: () => ({
		id: "test-provider",
		parseWebhook: mockParseWebhook,
	}),
}));

vi.mock("../sync", () => ({
	processWebhookEvents: mockProcessWebhookEvents,
}));

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

const { handlePaymentsWebhook } = await import("../webhook");

const req = () =>
	new Request("https://app.test/api/webhooks/payments", {
		method: "POST",
		body: "{}",
	});

describe("handlePaymentsWebhook", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 401 + generic body on signature failure", async () => {
		mockParseWebhook.mockRejectedValue(new Error("Invalid signature"));

		const res = await handlePaymentsWebhook(req());

		expect(res.status).toBe(401);
		expect(await res.text()).toBe("invalid signature");
	});

	it("returns 400 + generic body on malformed payload", async () => {
		mockParseWebhook.mockRejectedValue(
			new Error("Malformed webhook payload: unexpected token at 3"),
		);

		const res = await handlePaymentsWebhook(req());

		expect(res.status).toBe(400);
		// Raw provider error must not leak to the caller.
		expect(await res.text()).toBe("malformed payload");
	});

	it("returns 500 on missing webhook secret (provider should retry)", async () => {
		mockParseWebhook.mockRejectedValue(
			new Error("POLAR_WEBHOOK_SECRET is not configured"),
		);

		const res = await handlePaymentsWebhook(req());

		expect(res.status).toBe(500);
		expect(await res.text()).toBe("webhook misconfigured");
	});

	it("returns 200 without syncing when no events parsed", async () => {
		mockParseWebhook.mockResolvedValue([]);

		const res = await handlePaymentsWebhook(req());

		expect(res.status).toBe(200);
		expect(mockProcessWebhookEvents).not.toHaveBeenCalled();
	});

	it("returns 500 when sync throws so the provider retries", async () => {
		mockParseWebhook.mockResolvedValue([{ type: "subscription.updated" }]);
		mockProcessWebhookEvents.mockRejectedValue(new Error("db down"));

		const res = await handlePaymentsWebhook(req());

		expect(res.status).toBe(500);
	});
});
