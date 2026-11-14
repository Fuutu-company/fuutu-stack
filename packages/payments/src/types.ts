/**
 * @fuutu/payments — provider-agnostic interface.
 *
 * ## Architecture
 *
 * This package owns the full payment lifecycle through a unified
 * `PaymentProvider` interface. Provider SDKs (Stripe, Creem, Polar) are
 * called directly — no Better Auth payment plugin is mounted. Our
 * `Purchase` table (in @fuutu/db) is the single source of truth for
 * subscription status, populated by the shared `WebhookSync` layer.
 *
 * The interface is intentionally minimal:
 *   - Checkout & portal → redirect to provider-hosted pages
 *   - Customer creation → called on user signup
 *   - Subscription cancel → called from org-delete automation
 *   - Webhook parsing → provider verifies signature + returns normalized events
 *
 * Everything else (invoices, payment methods, plan changes, tax) lives at
 * the provider's customer portal. We only sync status back via webhooks.
 */

// ─── Provider Event (normalized webhook payload) ─────────────────────────────

export type ProviderEventType =
	| "checkout.completed"
	| "subscription.activated"
	| "subscription.renewed"
	| "subscription.updated"
	| "subscription.past_due"
	| "subscription.paused"
	| "subscription.scheduled_cancel"
	| "subscription.canceled"
	| "subscription.expired"
	| "one_time.purchased";

/**
 * Normalized event extracted from a provider webhook.
 * Providers parse their native payload into this shape; the shared
 * `WebhookSync` layer maps it to `Purchase` table mutations.
 */
export interface ProviderEvent {
	type: ProviderEventType;
	/**
	 * Provider-side event/delivery id (Stripe `event.id`, Creem `id`,
	 * Polar `webhook-id` header). Used to deduplicate one-time
	 * `checkout.completed` redeliveries.
	 */
	eventId?: string;
	subscriptionId?: string;
	customerId?: string;
	/** Provider-side product/price ID — mapped to a PlanId via config. */
	productId?: string;
	/** Normalized status to write directly to the Purchase row. */
	status?: PurchaseStatusLiteral;
	currentPeriodEnd?: Date;
	/**
	 * Purchased unit/seat count (Creem `units`, Stripe item `quantity`,
	 * Polar `seats`). Persisted to `Purchase.quantity`; absent → the
	 * stored quantity is left unchanged (new rows default to 1).
	 */
	units?: number;
	/** Contains user_id / organization_id (passed through checkout metadata). */
	metadata?: Record<string, unknown>;
	/**
	 * Invoice details when the event is invoice-backed (e.g. Stripe
	 * `invoice.paid` / `invoice.payment_failed`). Providers whose webhooks
	 * carry no invoice object (Creem, Polar) omit it — the sync layer then
	 * writes no Invoice row.
	 */
	invoice?: ProviderInvoiceData;
}

/**
 * Provider-side invoice extracted from a webhook payload. `amount` is a
 * major-unit decimal string (e.g. "19.00") matching `Invoice.amount`
 * (Prisma Decimal) — the provider converts from minor units.
 */
export interface ProviderInvoiceData {
	/** Provider-side invoice id — used as the dedup key. */
	id: string;
	/** Hosted invoice page URL (e.g. Stripe hosted_invoice_url). */
	url?: string;
	pdfUrl?: string;
	amount: string;
	currency?: string;
	/** DB status literal: "paid" | "open" | "void" | "uncollectible". */
	status: string;
	issuedAt?: Date;
	paidAt?: Date;
}

// ─── Status literal (mirrors PurchaseStatus enum in DB) ──────────────────────

export type PurchaseStatusLiteral =
	| "ACTIVE"
	| "TRIALING"
	| "PAST_DUE"
	| "SCHEDULED_CANCEL"
	| "PAUSED"
	| "CANCELED"
	| "EXPIRED"
	| "INCOMPLETE";

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CheckoutInput {
	/** Provider-side price/product ID. */
	priceId: string;
	userId?: string;
	organizationId?: string;
	/** Seat count for seat-based plans. */
	seats?: number;
	/**
	 * Free-trial length for subscription checkouts (`PLANS[].trialDays`).
	 * Stripe: `subscription_data.trial_period_days`; Polar: a day-interval
	 * checkout trial; Creem: ignored — its checkout API has no trial
	 * parameter, trials are configured on the Creem product.
	 */
	trialDays?: number;
	/**
	 * Whether this checkout starts a trial (the billing policy's decision).
	 * `false`: no trial even when the product carries one — Polar sends
	 * `allowTrial: false`; Creem trials live on the product, so the caller
	 * picks a no-trial product instead (`Plan.noTrialPriceIdEnvVars`).
	 * Omitted: the provider default.
	 */
	trial?: boolean;
	successUrl?: string;
	cancelUrl?: string;
	customerEmail?: string;
	metadata?: Record<string, unknown>;
}

export interface PortalInput {
	customerId: string;
	returnUrl?: string;
}

export interface CustomerInput {
	userId: string;
	email: string;
	name?: string;
	metadata?: Record<string, unknown>;
}

/**
 * How a seat change is billed:
 * - "charge-immediately": the prorated difference is settled now — an
 *   increase is charged right away; for a decrease Creem applies its
 *   proration rules and Stripe (`always_invoice`) leaves an account
 *   credit on the customer balance for later invoices, not a refund
 * - "none": no proration — the new count is billed from the next period
 * Polar ignores it (its organization setting applies; logged as a warning).
 */
export type SeatProration = "charge-immediately" | "none";

export interface SetSeatsInput {
	subscriptionId: string;
	seats: number;
	/**
	 * Per-call billing of the change. Omitted: the provider default
	 * (Creem `paymentsConfig.creemUpdateBehavior`, Stripe
	 * `create_prorations`). Polar ignores it and applies its organization
	 * setting.
	 */
	proration?: SeatProration;
}

export interface CancelSubscriptionOptions {
	/**
	 * - "immediate": end the subscription now
	 * - "period_end": cancel when the current period ends — it keeps
	 *   granting access until then and can be resumed (`resumeSubscription`)
	 * Omitted: `atPeriodEnd`, else cancel now (Creem: the store's
	 * configured cancellation mode). Pass it whenever the outcome matters.
	 */
	mode?: CancelMode;
	/** Alias of `mode: "period_end"`; `mode` wins when both are set. */
	atPeriodEnd?: boolean;
}

export type CancelMode = "immediate" | "period_end";

/** The requested cancel mode; `undefined` leaves it to the provider default. */
export function resolveCancelMode(
	options: CancelSubscriptionOptions | undefined,
): CancelMode | undefined {
	if (options?.mode) return options.mode;
	return options?.atPeriodEnd ? "period_end" : undefined;
}

// ─── PaymentProvider interface ────────────────────────────────────────────────

export type PaymentsWebhookHandler = (request: Request) => Promise<Response>;

export interface PaymentProvider {
	readonly id: string;
	/**
	 * When `true`, the provider's upstream integration already reacts to
	 * organization membership changes and syncs seats on the subscription.
	 * Callers MUST skip their own `setSubscriptionSeats` call in that case
	 * to avoid races / double mutations. Defaults to `false`.
	 */
	readonly ownsSeatSync?: boolean;
	/**
	 * When `true`, trials are configured on the provider product, not per
	 * checkout (Creem) — `CheckoutInput.trialDays` is ignored, so a
	 * checkout without a trial needs a product without one
	 * (`Plan.noTrialPriceIdEnvVars`).
	 */
	readonly trialsOnProduct?: boolean;

	/** Create a provider-hosted checkout URL and redirect the user there. */
	createCheckoutLink(input: CheckoutInput): Promise<{ url: string }>;

	/** Create a provider-hosted customer portal URL for billing management. */
	createCustomerPortalLink(input: PortalInput): Promise<{ url: string }>;

	/**
	 * Create a customer record at the provider. Called on user signup
	 * so checkout can link to an existing customer. Stores the returned
	 * ID in `User.paymentsCustomerId`.
	 */
	createCustomer(input: CustomerInput): Promise<{ customerId: string }>;

	/**
	 * Cancel a subscription at the provider. Called from org-delete
	 * automation and `payments.subscription.cancel`.
	 */
	cancelSubscription(
		subscriptionId: string,
		options?: CancelSubscriptionOptions,
	): Promise<void>;

	/**
	 * Optional: undo a cancellation scheduled for the period end
	 * (`cancelSubscription(id, { atPeriodEnd: true })`). Providers without
	 * it answer `payments.subscription.resume` with NOT_IMPLEMENTED.
	 */
	resumeSubscription?(subscriptionId: string): Promise<void>;

	/**
	 * Optional: the subscription's current status at the provider. Webhook
	 * sync calls it after a failed `cancelSubscription` to tell "already
	 * canceled" (row may be closed) from a transient failure (row stays
	 * active). Throw when the lookup itself fails.
	 */
	getSubscriptionStatus?(
		subscriptionId: string,
	): Promise<PurchaseStatusLiteral>;

	/**
	 * Verify the webhook signature and parse the raw request into
	 * normalized `ProviderEvent[]`. One webhook delivery may contain
	 * multiple events (e.g. Stripe batches). The shared `webhookHandler`
	 * calls this and feeds the result to `WebhookSync`.
	 *
	 * Must NOT write to the database — that's `WebhookSync`'s job.
	 * On failure, throw a typed error — the shared webhook handler maps
	 * `WebhookSignatureError` → 401, `WebhookConfigError` → 500,
	 * `PaymentsDisabledError` → 501, anything else → 400.
	 */
	parseWebhook(request: Request): Promise<ProviderEvent[]>;
}

/**
 * Optional seat-management extension. Providers that support seat-based
 * billing implement this in addition to the base interface.
 */
export interface SeatAwarePaymentProvider extends PaymentProvider {
	setSubscriptionSeats(input: SetSeatsInput): Promise<void>;
	/**
	 * Optional provider capability for apps — the kit itself does not call
	 * it: the seats the provider bills for the subscription right now (e.g.
	 * to decide add vs remove against the provider instead of a possibly
	 * stale `Purchase.quantity`). Creem: the item's `units`; Stripe: the
	 * item's `quantity`; Polar: `seats` (1 for a subscription that is not
	 * seat-based — Polar reports none). Throws when the lookup fails or the
	 * provider reports no count.
	 */
	getSubscriptionSeats?(subscriptionId: string): Promise<number>;
}

/**
 * Type guard: true when the provider supports seat management.
 */
export function isSeatAware(
	provider: PaymentProvider,
): provider is SeatAwarePaymentProvider {
	return (
		typeof (provider as SeatAwarePaymentProvider).setSubscriptionSeats ===
		"function"
	);
}

// ─── Typed errors ─────────────────────────────────────────────────────────────
// Providers throw these so shared layers (webhook HTTP handler, callers)
// can map them by `instanceof` instead of sniffing error-message substrings.

/**
 * Payments are disabled — the active provider is `noop` (either
 * `paymentsConfig.provider = "noop"` or `config.features.payments === false`).
 * Maps to HTTP 501 at the webhook boundary.
 */
export class PaymentsDisabledError extends Error {
	constructor(message?: string) {
		super(message);
		this.name = "PaymentsDisabledError";
	}
}

/**
 * Webhook signature verification failed — the delivery is not authentic.
 * Maps to HTTP 401 at the webhook boundary.
 */
export class WebhookSignatureError extends Error {
	constructor(message?: string) {
		super(message);
		this.name = "WebhookSignatureError";
	}
}

/**
 * Webhook handling is misconfigured on our side (missing secret, missing
 * API key). Maps to HTTP 500 so the provider retries after the fix.
 */
export class WebhookConfigError extends Error {
	constructor(message?: string) {
		super(message);
		this.name = "WebhookConfigError";
	}
}

const CHECKOUT_REJECTED = Symbol.for("fuutu.payments.CheckoutRejectedError");

/**
 * A checkout guard refused the plan checkout (`registerCheckoutGuard`).
 * `reason` is a stable, app-defined code (e.g. `"addon_requires_base"`)
 * the client may branch on; it reaches the caller as
 * `PRECONDITION_FAILED` with `data.reason`, so it must not carry secrets.
 */
export class CheckoutRejectedError extends Error {
	readonly reason: string;
	readonly [CHECKOUT_REJECTED] = true;
	constructor(reason: string, message?: string) {
		super(message ?? `Checkout rejected: ${reason}`);
		this.name = "CheckoutRejectedError";
		this.reason = reason;
	}

	/**
	 * Guards are registered in one bundle (server start) and run in
	 * another (the API route): Next.js evaluates this module once per
	 * bundle, so `instanceof` checks a global brand, not class identity.
	 * Subclasses inherit this method; they keep the prototype check.
	 */
	static [Symbol.hasInstance](value: unknown): boolean {
		// biome-ignore lint/complexity/noThisInStatic: `this` is the class `instanceof` asks about — a subclass must not match by the shared brand.
		if (this !== CheckoutRejectedError) {
			// biome-ignore lint/complexity/noThisInStatic: as above.
			return Function.prototype[Symbol.hasInstance].call(this, value);
		}
		return (
			typeof value === "object" &&
			value !== null &&
			(value as { [CHECKOUT_REJECTED]?: unknown })[CHECKOUT_REJECTED] === true
		);
	}
}
