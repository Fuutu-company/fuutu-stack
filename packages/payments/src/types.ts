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

export interface SetSeatsInput {
	subscriptionId: string;
	seats: number;
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
	 * automation — not user-facing (users cancel via the portal).
	 */
	cancelSubscription(subscriptionId: string): Promise<void>;

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
