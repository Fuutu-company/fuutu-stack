import { describe, expect, it } from "vitest";
import { noopPaymentProvider } from "../providers/skeletons";
import { PaymentsDisabledError } from "../types";
import { testPaymentProviderContract } from "./provider-contract.test";

testPaymentProviderContract("noop", () => noopPaymentProvider, {
	behavior: "throws",
	throwsContains: "not implemented",
});

describe("noop skeleton — id is noop", () => {
	it("has id 'noop'", () => {
		expect(noopPaymentProvider.id).toBe("noop");
	});
});

describe("noop skeleton — PaymentsDisabledError", () => {
	it("rejects every method with PaymentsDisabledError", async () => {
		await expect(
			noopPaymentProvider.createCheckoutLink({ priceId: "price_test" }),
		).rejects.toThrow(PaymentsDisabledError);
		await expect(
			noopPaymentProvider.createCustomerPortalLink({
				customerId: "cust_test",
			}),
		).rejects.toThrow(PaymentsDisabledError);
		await expect(
			noopPaymentProvider.createCustomer({
				userId: "user_test",
				email: "t@t.com",
			}),
		).rejects.toThrow(PaymentsDisabledError);
		await expect(
			noopPaymentProvider.cancelSubscription("sub_test"),
		).rejects.toThrow(PaymentsDisabledError);
		await expect(
			noopPaymentProvider.parseWebhook(
				new Request("https://app.test/api/webhooks/payments", {
					method: "POST",
					body: "{}",
				}),
			),
		).rejects.toThrow(PaymentsDisabledError);
	});

	it("keeps the honest not-implemented message", async () => {
		await expect(
			noopPaymentProvider.createCheckoutLink({ priceId: "price_test" }),
		).rejects.toThrow("not implemented");
	});
});
