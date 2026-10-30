import { beforeEach, describe, expect, it, vi } from "vitest";
import { paymentsConfig } from "../config";
import {
	PaymentsDisabledError,
	WebhookConfigError,
	WebhookSignatureError,
} from "../types";

const mockParseWebhook = vi.fn();
const mockResolvePaymentProvider = vi.fn();
const mockProcessWebhookEvents = vi.fn();

vi.mock("../resolve", () => ({
	resolvePaymentProvider: () => mockResolvePaymentProvider(),
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
		paymentsConfig.provider = "creem";
		mockResolvePaymentProvider.mockReturnValue({
			id: "test-provider",
			parseWebhook: mockParseWebhook,
		});
	});

	it("returns 401 + generic body on signature failure", async () => {
		mockParseWebhook.mockRejectedValue(
			new WebhookSignatureError("Invalid signature"),
		);

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
			new WebhookConfigError("POLAR_WEBHOOK_SECRET is not configured"),
		);

		const res = await handlePaymentsWebhook(req());

		expect(res.status).toBe(500);
		expect(await res.text()).toBe("webhook misconfigured");
	});

	it("returns 500 when provider resolution throws a misconfig error", async () => {
		// e.g. provider "custom" without paymentsConfig.customProvider —
		// resolvePaymentProvider() throws WebhookConfigError, which must land
		// in the error-type mapping (not escape as an unhandled throw).
		mockResolvePaymentProvider.mockImplementation(() => {
			throw new WebhookConfigError("customProvider is not set");
		});

		const res = await handlePaymentsWebhook(req());

		expect(res.status).toBe(500);
		expect(await res.text()).toBe("webhook misconfigured");
		expect(mockParseWebhook).not.toHaveBeenCalled();
	});

	it("returns 501 when the provider reports payments disabled", async () => {
		mockParseWebhook.mockRejectedValue(
			new PaymentsDisabledError("not implemented"),
		);

		const res = await handlePaymentsWebhook(req());

		expect(res.status).toBe(501);
	});

	it("returns 501 without touching the provider when payments are disabled", async () => {
		paymentsConfig.provider = "noop";

		const res = await handlePaymentsWebhook(req());

		expect(res.status).toBe(501);
		expect(mockResolvePaymentProvider).not.toHaveBeenCalled();
		expect(mockParseWebhook).not.toHaveBeenCalled();
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
