import { describe, expect, it, vi } from "vitest";

// Mock env with only SOME top-up price IDs set — exercises the isEnvKey
// fallback for packages whose env var was never configured.
vi.mock("@fuutu/env/saas", () => ({
	env: {
		PAYMENTS_PRO_PRICE_ID: "price-pro-monthly",
		PAYMENTS_PRO_YEARLY_PRICE_ID: "price-pro-yearly",
		CREDITS_AI_TOKENS_100K_PRICE_ID: "price-100k",
		// CREDITS_AI_TOKENS_500K_PRICE_ID / CREDITS_API_CALLS_50K_PRICE_ID
		// intentionally absent — the lookup must fall back to undefined.
		NODE_ENV: "test",
	},
}));

const { getPlanIdForProductId, getCreditTopupPriceId, getPlanPriceId } =
	await import("../config.server");

describe("getPlanIdForProductId()", () => {
	it("maps the monthly price ID to its plan", () => {
		expect(getPlanIdForProductId("price-pro-monthly")).toBe("pro");
	});

	it("maps the yearly price ID to the same plan", () => {
		expect(getPlanIdForProductId("price-pro-yearly")).toBe("pro");
	});

	it("returns undefined for an unknown product ID", () => {
		expect(getPlanIdForProductId("prod_unknown")).toBeUndefined();
	});
});

describe("getPlanPriceId()", () => {
	it("returns the monthly price ID for the pro plan", () => {
		expect(getPlanPriceId("pro", "month")).toBe("price-pro-monthly");
	});

	it("returns the yearly price ID for the pro plan", () => {
		expect(getPlanPriceId("pro", "year")).toBe("price-pro-yearly");
	});

	it("returns undefined for a plan without a price mapping", () => {
		// Fails closed — a checkoutable plan with no `priceIdEnvVars` entry
		// must never fall through to another plan's price.
		expect(getPlanPriceId("free", "month")).toBeUndefined();
		expect(getPlanPriceId("enterprise", "month")).toBeUndefined();
	});
});

describe("getCreditTopupPriceId()", () => {
	it("returns the env-backed price ID for a configured package", () => {
		expect(getCreditTopupPriceId("ai_tokens_100k")).toBe("price-100k");
	});

	it("returns undefined when the package's env var is not set", () => {
		// priceIdEnvVar names a key that is absent from env — the isEnvKey
		// guard must return undefined instead of reading a missing key.
		expect(getCreditTopupPriceId("ai_tokens_500k")).toBeUndefined();
	});

	it("returns undefined for an unknown top-up id", () => {
		expect(getCreditTopupPriceId("not_a_topup")).toBeUndefined();
	});
});
