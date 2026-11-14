import type { PlanId } from "@fuutu/payments/config";
import { fixturePlanId, makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";

vi.mock("@fuutu/payments/config", async (importOriginal) => ({
	// Fixed kit plan catalog (@fuutu/test-utils), not the app's PLANS.
	...(await importOriginal<typeof import("@fuutu/payments/config")>()),
	...(await import("@fuutu/test-utils")).planCatalogFixture,
}));

// The plan's no-trial product, per test (`Plan.noTrialPriceIdEnvVars`).
const noTrialPriceId = vi.hoisted(() => ({
	current: undefined as string | undefined,
}));

vi.mock("@fuutu/payments/config.server", () => ({
	getPlanPriceId: vi.fn(
		(_planId: string, _interval: string, opts?: { trial?: boolean }) =>
			opts?.trial === false && noTrialPriceId.current
				? noTrialPriceId.current
				: "price-pro-monthly",
	),
	getPlanNoTrialPriceId: vi.fn(() => noTrialPriceId.current),
}));

const mockAssertCheckoutAllowed = vi.hoisted(() => vi.fn());
const mockProvider = vi.hoisted(() => ({
	id: "creem",
	trialsOnProduct: true as boolean | undefined,
	createCheckoutLink: vi.fn(),
}));

vi.mock("@fuutu/payments", () => ({
	assertCheckoutAllowed: mockAssertCheckoutAllowed,
	CheckoutRejectedError: class CheckoutRejectedError extends Error {
		readonly reason: string;
		constructor(reason: string) {
			super(reason);
			this.reason = reason;
		}
	},
	resolvePaymentProvider: () => mockProvider,
	PaymentsDisabledError: class PaymentsDisabledError extends Error {},
	WebhookConfigError: class WebhookConfigError extends Error {},
}));

vi.mock("@fuutu/db", () => ({}));
vi.mock("@fuutu/ai", () => ({ resolveAIProvider: vi.fn() }));

const { CheckoutRejectedError } = await import("@fuutu/payments");
const { paymentsRouter } = await import("../modules/payments/router");

const context = makeSession<Context>(makeUser({ id: "user-guard" }));

describe("payments.checkout.create — checkout guards", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		noTrialPriceId.current = undefined;
		mockProvider.trialsOnProduct = true;
		mockProvider.createCheckoutLink.mockResolvedValue({
			url: "https://checkout.example.com",
		});
	});

	it("a denying guard returns PRECONDITION_FAILED with data.reason and never calls the provider", async () => {
		mockAssertCheckoutAllowed.mockRejectedValue(
			new CheckoutRejectedError("addon_requires_base"),
		);

		await expect(
			call(
				paymentsRouter.checkout.create,
				{ planId: fixturePlanId<PlanId>("pro") },
				{ context },
			),
		).rejects.toMatchObject({
			code: "PRECONDITION_FAILED",
			data: { reason: "addon_requires_base" },
		});
		expect(mockProvider.createCheckoutLink).not.toHaveBeenCalled();
	});

	it("passes the owner, acting user, plan, interval and seats to the guards", async () => {
		mockAssertCheckoutAllowed.mockResolvedValue({ trial: true });

		await call(
			paymentsRouter.checkout.create,
			{ planId: fixturePlanId<PlanId>("pro"), interval: "year", seats: 4 },
			{ context },
		);

		expect(mockAssertCheckoutAllowed).toHaveBeenCalledWith({
			owner: { userId: "user-guard" },
			userId: "user-guard",
			planId: "pro",
			interval: "year",
			seats: 4,
		});
		expect(mockProvider.createCheckoutLink).toHaveBeenCalledOnce();
	});

	it("a guard's unexpected error fails the request without reaching the provider", async () => {
		mockAssertCheckoutAllowed.mockRejectedValue(new Error("db down"));

		await expect(
			call(
				paymentsRouter.checkout.create,
				{ planId: fixturePlanId<PlanId>("pro") },
				{ context },
			),
		).rejects.not.toMatchObject({ code: "PRECONDITION_FAILED" });
		expect(mockProvider.createCheckoutLink).not.toHaveBeenCalled();
	});
});

describe("payments.checkout.create — trials", () => {
	const checkout = (input: { skipTrial?: boolean } = {}) =>
		call(
			paymentsRouter.checkout.create,
			{ planId: fixturePlanId<PlanId>("pro"), ...input },
			{ context },
		);
	const sent = () => mockProvider.createCheckoutLink.mock.calls[0]?.[0];

	beforeEach(() => {
		vi.clearAllMocks();
		noTrialPriceId.current = undefined;
		mockProvider.trialsOnProduct = true;
		mockProvider.createCheckoutLink.mockResolvedValue({
			url: "https://checkout.example.com",
		});
	});

	it("plans without trialOnce behave as before: trial product and trialDays", async () => {
		mockAssertCheckoutAllowed.mockResolvedValue({ trial: true });
		await checkout();
		expect(sent()).toMatchObject({
			priceId: "price-pro-monthly",
			trialDays: 14,
		});
	});

	it("trial false uses the no-trial price id and omits trialDays", async () => {
		noTrialPriceId.current = "price-pro-notrial";
		mockAssertCheckoutAllowed.mockResolvedValue({ trial: false });
		await checkout();
		expect(sent()?.priceId).toBe("price-pro-notrial");
		expect(sent()).not.toHaveProperty("trialDays");
	});

	it("creem without a no-trial id answers trial_unavailable", async () => {
		mockAssertCheckoutAllowed.mockResolvedValue({ trial: false });
		await expect(checkout()).rejects.toMatchObject({
			code: "PRECONDITION_FAILED",
			data: { reason: "trial_unavailable" },
		});
		expect(mockProvider.createCheckoutLink).not.toHaveBeenCalled();
	});

	it("a provider with per-checkout trials only drops trialDays", async () => {
		mockProvider.trialsOnProduct = undefined;
		mockAssertCheckoutAllowed.mockResolvedValue({ trial: false });
		await checkout();
		expect(sent()?.priceId).toBe("price-pro-monthly");
		expect(sent()).not.toHaveProperty("trialDays");
	});

	it("passes skipTrial to the billing policy", async () => {
		noTrialPriceId.current = "price-pro-notrial";
		mockAssertCheckoutAllowed.mockResolvedValue({ trial: false });
		await checkout({ skipTrial: true });
		expect(mockAssertCheckoutAllowed).toHaveBeenCalledWith(
			expect.objectContaining({ skipTrial: true }),
		);
	});
});
