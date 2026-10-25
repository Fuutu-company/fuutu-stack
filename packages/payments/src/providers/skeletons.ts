import { type PaymentProvider, PaymentsDisabledError } from "../types";

/**
 * Skeleton providers — inactive, fail loud on first use.
 *
 * Keep the surface identical to real providers so swapping a provider
 * is a single `paymentsConfig.provider = "stripe"` edit plus implementing
 * the methods. Every unimplemented method rejects with a typed
 * `PaymentsDisabledError` so callers can map "payments off" distinctly
 * from "provider misconfigured".
 */
function makeSkeleton(id: string): PaymentProvider {
	const reject = (fn: string): Promise<never> =>
		Promise.reject(
			new PaymentsDisabledError(
				`[payments:${id}] ${fn}() not implemented — this provider is a skeleton. Activate it via paymentsConfig.provider and wire the SDK.`,
			),
		);
	return {
		id,
		ownsSeatSync: false,
		createCheckoutLink: () => reject("createCheckoutLink"),
		createCustomerPortalLink: () => reject("createCustomerPortalLink"),
		createCustomer: () => reject("createCustomer"),
		cancelSubscription: () => reject("cancelSubscription"),
		parseWebhook: () => reject("parseWebhook"),
	};
}

export const noopPaymentProvider = makeSkeleton("noop");
