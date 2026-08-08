/**
 * @fuutu/payments — provider-agnostic interface.
 *
 * ## Architecture
 *
 * This package is a **thin Fuutu-owned wrapper** over Better-Auth's
 * official payment plugins:
 *   - Polar  → `@polar-sh/better-auth`   (v1 active)
 *   - Stripe → `@better-auth/stripe`     (skeleton)
 *
 * See:
 *   https://better-auth.com/docs/plugins/polar
 *   https://better-auth.com/docs/plugins/stripe
 *
 * Better-Auth plugins already cover checkout creation, customer portal,
 * webhook signature verification and the Organization ↔ seat sync that
 * auth hooks trigger. We therefore **do not reimplement** those.
 *
 * The `PaymentProvider` interface exists as an extension seam for
 * capabilities Better-Auth does not expose — e.g. non-auth webhook
 * events (refunds, payment-intent metadata, fraud flags), raw customer
 * lookups, or custom seat-count policies. Active providers compose the
 * Better-Auth plugin output with their own logic and expose the union
 * through this interface.
 *
 * Skeletons for Lemonsqueezy / Creem / Dodopayments (no native BA plugin
 * yet) live in this same package so downstream users can swap providers
 * without a second dependency or code relocation.
 */

export type PaymentsWebhookHandler = (request: Request) => Promise<Response>;

export type CheckoutLinkInput = {
	priceId: string;
	userId?: string;
	organizationId?: string;
	successUrl?: string;
	cancelUrl?: string;
};

export type CustomerPortalInput = {
	customerId: string;
	returnUrl?: string;
};

export type SetSeatsInput = {
	subscriptionId: string;
	seats: number;
};

export interface PaymentProvider {
	readonly id: string;
	/**
	 * When `true`, the provider's upstream plugin (e.g. Better-Auth's
	 * Polar plugin) already reacts to organization membership changes
	 * and syncs seats on the subscription. Callers MUST skip their own
	 * `setSubscriptionSeats` call in that case to avoid races / double
	 * mutations. Defaults to `false` (caller owns seat-sync).
	 */
	readonly ownsSeatSync?: boolean;
	createCheckoutLink(input: CheckoutLinkInput): Promise<{ url: string }>;
	createCustomerPortalLink(
		input: CustomerPortalInput,
	): Promise<{ url: string }>;
	webhookHandler: PaymentsWebhookHandler;
	cancelSubscription(subscriptionId: string): Promise<void>;
	setSubscriptionSeats(input: SetSeatsInput): Promise<void>;
}
