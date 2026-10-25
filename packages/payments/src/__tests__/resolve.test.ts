import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/env/saas", () => ({
	env: {
		PAYMENTS_PROVIDER: "creem",
		NODE_ENV: "test",
	},
}));

const mockWarn = vi.fn();
const mockError = vi.fn();
vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: mockWarn,
		error: mockError,
		debug: vi.fn(),
	}),
}));

const { paymentsConfig, setPaymentProvider, isPaymentsEnabled } = await import(
	"../config"
);
const { WebhookConfigError } = await import("../types");
const { resolvePaymentProvider } = await import("../resolve");
const { noopPaymentProvider } = await import("../providers/skeletons");
const { creemPaymentProvider } = await import("../providers/creem");
const { stripePaymentProvider } = await import("../providers/stripe");
const { polarPaymentProvider } = await import("../providers/polar");

const originalProvider = paymentsConfig.provider;

afterEach(() => {
	paymentsConfig.provider = originalProvider;
	paymentsConfig.customProvider = undefined;
	vi.clearAllMocks();
});

describe("resolvePaymentProvider()", () => {
	it("resolves the provider named by paymentsConfig.provider", () => {
		paymentsConfig.provider = "creem";
		expect(resolvePaymentProvider()).toBe(creemPaymentProvider);

		paymentsConfig.provider = "stripe";
		expect(resolvePaymentProvider()).toBe(stripePaymentProvider);

		paymentsConfig.provider = "polar";
		expect(resolvePaymentProvider()).toBe(polarPaymentProvider);

		paymentsConfig.provider = "noop";
		expect(resolvePaymentProvider()).toBe(noopPaymentProvider);
	});

	it("throws WebhookConfigError when provider is 'custom' but no customProvider is set", () => {
		paymentsConfig.provider = "custom";
		expect(() => resolvePaymentProvider()).toThrow(WebhookConfigError);
		expect(() => resolvePaymentProvider()).toThrow(/customProvider is not set/);
	});

	it("returns paymentsConfig.customProvider when provider is 'custom'", () => {
		paymentsConfig.provider = "custom";
		paymentsConfig.customProvider = noopPaymentProvider;
		expect(resolvePaymentProvider()).toBe(noopPaymentProvider);
	});

	it("throws WebhookConfigError on an unknown provider instead of silently falling back to noop", () => {
		// Simulate a stale runtime value outside the union (e.g. a provider id
		// that was removed from PaymentProviderId but still set via env).
		const mutable = paymentsConfig as { provider: string };
		mutable.provider = "bogus-provider";
		expect(() => resolvePaymentProvider()).toThrow(WebhookConfigError);
		expect(() => resolvePaymentProvider()).toThrow(/unknown provider/);
	});
});

describe("isPaymentsEnabled()", () => {
	it("is true for a real provider", () => {
		paymentsConfig.provider = "creem";
		expect(isPaymentsEnabled()).toBe(true);
	});

	it("is false when the provider is noop", () => {
		paymentsConfig.provider = "noop";
		expect(isPaymentsEnabled()).toBe(false);
	});
});

describe("setPaymentProvider()", () => {
	it("mutates paymentsConfig.provider when payments are enabled", () => {
		setPaymentProvider("stripe");
		expect(paymentsConfig.provider).toBe("stripe");
	});
});

describe("features.payments master switch", () => {
	it("derives the noop provider and blocks setPaymentProvider when payments are disabled", async () => {
		vi.resetModules();
		vi.doMock("@fuutu/config", () => ({
			config: {
				features: {
					organizationsMode: "on",
					payments: false,
					credits: true,
				},
			},
		}));

		const mod = await import("../config");

		expect(mod.paymentsConfig.provider).toBe("noop");
		expect(mod.isPaymentsEnabled()).toBe(false);

		mod.setPaymentProvider("stripe");
		expect(mod.paymentsConfig.provider).toBe("noop");
		expect(mockWarn).toHaveBeenCalled();

		vi.doUnmock("@fuutu/config");
		vi.resetModules();
	});
});
