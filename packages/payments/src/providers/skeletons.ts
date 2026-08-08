import type { PaymentProvider } from "../types";

/**
 * Skeleton providers — inactive in v1.
 *
 * Keep the surface identical to the real Polar provider so swapping a
 * provider is a single `paymentsConfig.provider = "stripe"` edit plus
 * implementing the five methods below. Every unimplemented method throws
 * loudly at first use so a misconfigured deploy fails fast instead of
 * silently dropping checkouts.
 *
 * Each method is declared as an `async` rejection rather than via a
 * cast-to-never thunk: same fail-loud behaviour, but the resulting
 * object satisfies `PaymentProvider` without `as` coercions.
 */
function makeSkeleton(id: string): PaymentProvider {
	const reject = (fn: string): Promise<never> =>
		Promise.reject(
			new Error(
				`[payments:${id}] ${fn}() not implemented — this provider is a skeleton. Activate it via paymentsConfig.provider and wire the SDK.`,
			),
		);
	return {
		id,
		createCheckoutLink: () => reject("createCheckoutLink"),
		createCustomerPortalLink: () => reject("createCustomerPortalLink"),
		webhookHandler: async () =>
			new Response(JSON.stringify({ error: `${id}_not_implemented` }), {
				status: 501,
				headers: { "content-type": "application/json" },
			}),
		cancelSubscription: () => reject("cancelSubscription"),
		setSubscriptionSeats: () => reject("setSubscriptionSeats"),
	};
}

export const stripePaymentProvider = makeSkeleton("stripe");
export const lemonsqueezyPaymentProvider = makeSkeleton("lemonsqueezy");
export const creemPaymentProvider = makeSkeleton("creem");
export const dodopaymentsPaymentProvider = makeSkeleton("dodopayments");
export const noopPaymentProvider = makeSkeleton("noop");
