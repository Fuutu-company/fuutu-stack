/**
 * @fuutu/payments — server-side barrel.
 *
 * Importing this entry pulls env validation, the DB client, and provider
 * SDKs — it is for server code only (API procedures, auth hooks, webhook
 * routes). Client components must import from the leaf subpaths instead:
 *   `@fuutu/payments/config`  — paymentsConfig, PLANS, LIMITS, CREDITS
 *   `@fuutu/payments/plans`   — buildPricingTiers()
 *   `@fuutu/payments/features`— feature/limit helpers
 */
export {
	type AudienceId,
	type BillingAttachedTo,
	type BillingInterval,
	type BillingType,
	CREDIT_TOPUPS,
	CREDITS,
	type CreditTopupPackage,
	FEATURE_CATALOG,
	type FeatureEntry,
	isPaymentsEnabled,
	LIMITS,
	type LimitValue,
	type PaymentProviderId,
	type PaymentsConfig,
	PLAN_IDS,
	PLANS,
	type Plan,
	type PlanAmount,
	type PlanId,
	type PlanLimits,
	type PlanTier,
	paymentsConfig,
	setPaymentProvider,
} from "./config";
export { getPlanIdForProductId } from "./config.server";
export { createCustomerForUser } from "./customers";
export {
	type CatalogFeature,
	FEATURE_GROUPS,
	type FeatureGroup,
	formatLimit,
	getLimit,
	getPricingFeaturesForPlan,
	type LimitKey,
	planIdToTier,
} from "./features";
export {
	checkLimit,
	getPlanLimit,
	type LimitCheckResult,
	meetsTier,
	type ResolvedPlan,
	resolveActivePlan,
} from "./plan-resolver";
export {
	type BuildPricingTiersOptions,
	type BuiltPricingTier,
	buildPricingTiers,
	type PlanTranslationResolver,
	type PlanTranslations,
} from "./plans";
export { creemPaymentProvider } from "./providers/creem";
export { polarPaymentProvider } from "./providers/polar";
export { noopPaymentProvider } from "./providers/skeletons";
export { stripePaymentProvider } from "./providers/stripe";
export { resolvePaymentProvider } from "./resolve";
export {
	cancelAllSubscriptionsForOrganization,
	updateSeatsInOrganizationSubscription,
} from "./seats";
export { getActivePlanId, processWebhookEvents } from "./sync";
export type {
	CheckoutInput,
	CustomerInput,
	PaymentProvider,
	PaymentsWebhookHandler,
	PortalInput,
	ProviderEvent,
	ProviderEventType,
	PurchaseStatusLiteral,
	SeatAwarePaymentProvider,
	SetSeatsInput,
} from "./types";
export {
	isSeatAware,
	PaymentsDisabledError,
	WebhookConfigError,
	WebhookSignatureError,
} from "./types";
export { handlePaymentsWebhook } from "./webhook";
