import { describe, expect, it, vi } from "vitest";

// Mock the Polar SDK at the module boundary — no real network calls.
const checkoutsCreate = vi
	.fn()
	.mockResolvedValue({ url: "https://checkout.test/url" });
const customerSessionsCreate = vi.fn().mockResolvedValue({
	customerPortalUrl: "https://portal.test/url",
});
const subscriptionsRevoke = vi.fn().mockResolvedValue(undefined);

vi.mock("@polar-sh/sdk", () => ({
	Polar: class MockPolar {
		checkouts = { create: checkoutsCreate };
		customerSessions = { create: customerSessionsCreate };
		subscriptions = { revoke: subscriptionsRevoke };
	},
}));

vi.mock("@polar-sh/sdk/webhooks", () => ({
	validateEvent: vi.fn().mockReturnValue({ type: "test.event" }),
	WebhookVerificationError: class WebhookVerificationError extends Error {},
}));

vi.mock("@fuutu/env/saas", () => ({
	env: {
		POLAR_ACCESS_TOKEN: "test-polar-token",
		POLAR_SUCCESS_URL: "https://app.test/success",
		POLAR_WEBHOOK_SECRET: "test-webhook-secret",
		NODE_ENV: "test",
	},
}));

const { polarPaymentProvider } = await import("../providers/polar");
const { testPaymentProviderContract } = await import(
	"./provider-contract.test"
);

testPaymentProviderContract("polar", () => polarPaymentProvider, {
	behavior: "resolves",
});

describe("polar provider — SDK integration", () => {
	it("createCheckoutLink calls Polar checkouts.create and returns the url", async () => {
		checkoutsCreate.mockClear();
		const result = await polarPaymentProvider.createCheckoutLink({
			priceId: "price_abc",
			userId: "user_123",
		});
		expect(result.url).toBe("https://checkout.test/url");
		expect(checkoutsCreate).toHaveBeenCalledOnce();
	});

	it("createCustomerPortalLink calls customerSessions.create and returns the url", async () => {
		customerSessionsCreate.mockClear();
		const result = await polarPaymentProvider.createCustomerPortalLink({
			customerId: "cust_123",
		});
		expect(result.url).toBe("https://portal.test/url");
		expect(customerSessionsCreate).toHaveBeenCalledOnce();
	});

	it("cancelSubscription calls subscriptions.revoke", async () => {
		subscriptionsRevoke.mockClear();
		await polarPaymentProvider.cancelSubscription("sub_123");
		expect(subscriptionsRevoke).toHaveBeenCalledOnce();
	});

	it("ownsSeatSync is true (Better-Auth plugin handles seat sync)", () => {
		expect(polarPaymentProvider.ownsSeatSync).toBe(true);
	});

	it("webhookHandler returns 200 on a valid signature", async () => {
		const request = new Request("https://app.test/api/webhooks/payments", {
			method: "POST",
			headers: {
				"webhook-id": "test",
				"webhook-timestamp": "123",
				"webhook-signature": "test",
			},
			body: "{}",
		});
		const response = await polarPaymentProvider.webhookHandler(request);
		expect(response.status).toBe(200);
	});

	it("webhookHandler returns 401 on an invalid signature", async () => {
		const { validateEvent, WebhookVerificationError } = await import(
			"@polar-sh/sdk/webhooks"
		);
		vi.mocked(validateEvent).mockImplementationOnce(() => {
			throw new WebhookVerificationError("invalid signature");
		});
		const request = new Request("https://app.test/api/webhooks/payments", {
			method: "POST",
			headers: {
				"webhook-id": "test",
				"webhook-timestamp": "123",
				"webhook-signature": "bad",
			},
			body: "{}",
		});
		const response = await polarPaymentProvider.webhookHandler(request);
		expect(response.status).toBe(401);
	});

	it("webhookHandler returns 500 on a generic (non-verification) error", async () => {
		const { validateEvent } = await import("@polar-sh/sdk/webhooks");
		vi.mocked(validateEvent).mockImplementationOnce(() => {
			throw new Error("unexpected runtime failure");
		});
		const request = new Request("https://app.test/api/webhooks/payments", {
			method: "POST",
			headers: {
				"webhook-id": "test",
				"webhook-timestamp": "123",
				"webhook-signature": "test",
			},
			body: "{}",
		});
		const response = await polarPaymentProvider.webhookHandler(request);
		expect(response.status).toBe(500);
	});

	it("webhookHandler returns 503 when POLAR_WEBHOOK_SECRET is unset", async () => {
		const { env } = await import("@fuutu/env/saas");
		const original = env.POLAR_WEBHOOK_SECRET;
		// @ts-expect-error — mutating a mocked readonly env for this test
		env.POLAR_WEBHOOK_SECRET = undefined;
		try {
			const request = new Request("https://app.test/api/webhooks/payments", {
				method: "POST",
				headers: {
					"webhook-id": "test",
					"webhook-timestamp": "123",
					"webhook-signature": "test",
				},
				body: "{}",
			});
			const response = await polarPaymentProvider.webhookHandler(request);
			expect(response.status).toBe(503);
		} finally {
			// @ts-expect-error — restoring the mocked env value
			env.POLAR_WEBHOOK_SECRET = original;
		}
	});
});
