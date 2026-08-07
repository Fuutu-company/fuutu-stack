import { describe, expect, it } from "vitest";
import {
	creemPaymentProvider,
	dodopaymentsPaymentProvider,
	lemonsqueezyPaymentProvider,
	noopPaymentProvider,
	stripePaymentProvider,
} from "../providers/skeletons";
import { testPaymentProviderContract } from "./provider-contract.test";

testPaymentProviderContract("stripe", () => stripePaymentProvider, {
	behavior: "throws",
	throwsContains: "not implemented",
});

testPaymentProviderContract("lemonsqueezy", () => lemonsqueezyPaymentProvider, {
	behavior: "throws",
	throwsContains: "not implemented",
});

testPaymentProviderContract("creem", () => creemPaymentProvider, {
	behavior: "throws",
	throwsContains: "not implemented",
});

testPaymentProviderContract("dodopayments", () => dodopaymentsPaymentProvider, {
	behavior: "throws",
	throwsContains: "not implemented",
});

testPaymentProviderContract("noop", () => noopPaymentProvider, {
	behavior: "throws",
	throwsContains: "not implemented",
});

describe("payments skeletons — webhookHandler returns 501", () => {
	for (const [name, provider] of [
		["stripe", stripePaymentProvider],
		["lemonsqueezy", lemonsqueezyPaymentProvider],
		["creem", creemPaymentProvider],
		["dodopayments", dodopaymentsPaymentProvider],
		["noop", noopPaymentProvider],
	] as const) {
		it(`${name} webhookHandler returns 501 not-implemented`, async () => {
			const response = await provider.webhookHandler(
				new Request("https://app.test/api/webhooks/payments", {
					method: "POST",
				}),
			);
			expect(response.status).toBe(501);
		});
	}
});
