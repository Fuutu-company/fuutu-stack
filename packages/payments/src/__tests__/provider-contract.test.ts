import { expectNonEmptyString } from "@fuutu/test-utils";
import { describe, expect, it } from "vitest";
import type {
	CheckoutLinkInput,
	CustomerPortalInput,
	PaymentProvider,
	SetSeatsInput,
} from "../types";

export interface PaymentProviderContractOptions {
	/** Whether the provider methods resolve or throw. */
	readonly behavior: "resolves" | "throws";
	/** Substring expected in thrown error messages (skeletons). */
	readonly throwsContains?: string;
}

/**
 * Shared contract every PaymentProvider must satisfy.
 * Called from one test file per provider so every swap candidate is covered.
 */
export function testPaymentProviderContract(
	id: string,
	createProvider: () => PaymentProvider,
	options: PaymentProviderContractOptions,
): void {
	const checkoutInput: CheckoutLinkInput = {
		priceId: "price_test",
		userId: "user_test",
	};
	const portalInput: CustomerPortalInput = {
		customerId: "cust_test",
	};
	const seatsInput: SetSeatsInput = {
		subscriptionId: "sub_test",
		seats: 3,
	};

	describe(`PaymentProvider contract — ${id}`, () => {
		it("exposes a non-empty id", () => {
			const provider = createProvider();
			expectNonEmptyString(provider.id);
		});

		it("webhookHandler is a function", () => {
			const provider = createProvider();
			expect(typeof provider.webhookHandler).toBe("function");
		});

		if (options.behavior === "resolves") {
			it("createCheckoutLink() returns { url }", async () => {
				const provider = createProvider();
				const result = await provider.createCheckoutLink(checkoutInput);
				expect(typeof result.url).toBe("string");
				expect(result.url.length).toBeGreaterThan(0);
			});

			it("createCustomerPortalLink() returns { url }", async () => {
				const provider = createProvider();
				const result = await provider.createCustomerPortalLink(portalInput);
				expect(typeof result.url).toBe("string");
				expect(result.url.length).toBeGreaterThan(0);
			});

			it("cancelSubscription() resolves", async () => {
				const provider = createProvider();
				await expect(
					provider.cancelSubscription("sub_test"),
				).resolves.toBeUndefined();
			});

			it("setSubscriptionSeats() resolves", async () => {
				const provider = createProvider();
				await expect(
					provider.setSubscriptionSeats(seatsInput),
				).resolves.toBeUndefined();
			});
		} else {
			it("createCheckoutLink() throws", async () => {
				const provider = createProvider();
				await expect(
					provider.createCheckoutLink(checkoutInput),
				).rejects.toThrow(options.throwsContains ?? "not implemented");
			});

			it("createCustomerPortalLink() throws", async () => {
				const provider = createProvider();
				await expect(
					provider.createCustomerPortalLink(portalInput),
				).rejects.toThrow(options.throwsContains ?? "not implemented");
			});

			it("cancelSubscription() throws", async () => {
				const provider = createProvider();
				await expect(provider.cancelSubscription("sub_test")).rejects.toThrow(
					options.throwsContains ?? "not implemented",
				);
			});

			it("setSubscriptionSeats() throws", async () => {
				const provider = createProvider();
				await expect(provider.setSubscriptionSeats(seatsInput)).rejects.toThrow(
					options.throwsContains ?? "not implemented",
				);
			});
		}
	});
}
