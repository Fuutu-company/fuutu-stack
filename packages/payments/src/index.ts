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
	ADDON_REQUIRES_BASE,
	ALREADY_SUBSCRIBED,
	assertCheckoutAllowed,
	type CheckoutDecision,
	type CheckoutRequest,
	getPlanSubscription,
	isAddonPlan,
} from "./billing-policy";
export {
	type AudienceId,
	type BillingAttachedTo,
	type BillingInterval,
	type BillingType,
	CREDIT_TOPUPS,
	CREDITS,
	type CreditTopupPackage,
	type CreemUpdateBehavior,
	FEATURE_CATALOG,
	type FeatureEntry,
	getSeatUpgradeUrl,
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
	type SeatSyncMode,
	setPaymentProvider,
	TIER_ORDER,
} from "./config";
export { getPlanIdForProductId } from "./config.server";
export { createCustomerForUser } from "./customers";
export {
	type Entitlement,
	type EntitlementScope,
	getOrgEntitlement,
	getUserEntitlement,
	hasFeature,
} from "./entitlements";
export {
	type ActivatedSubscription,
	type CheckoutGuard,
	type CheckoutGuardContext,
	type EntitlementResolver,
	type EntitlementResolverFn,
	type ExistingSubscription,
	getSeatGate,
	type OwnerPurchase,
	onPurchaseChanged,
	type PurchaseChangedHandler,
	registerCheckoutGuard,
	registerEntitlementResolver,
	registerSeatGate,
	registerSupersedePolicy,
	registerTrialEligibilityPolicy,
	type SeatGate,
	type SeatGateContext,
	type SupersedePolicy,
	type TrialEligibilityContext,
	type TrialEligibilityPolicy,
} from "./extensions";
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
export { resolvePaymentProvider, resolvePaymentProviderById } from "./resolve";
export {
	CHARGEABLE_SUBSCRIPTION_STATUSES,
	cancelAllSubscriptionsForOrganization,
	cancelAllSubscriptionsForOrganizationOrThrow,
	cancelSubscriptionNowOrThrow,
	reconcileOrganizationSeats,
	type SeatReconcileResult,
	updateSeatsInOrganizationSubscription,
} from "./seats";
export { getActivePlanId, processWebhookEvents } from "./sync";
export type {
	CancelMode,
	CancelSubscriptionOptions,
	CheckoutInput,
	CheckoutLink,
	CustomerInput,
	PaymentProvider,
	PaymentsWebhookHandler,
	PortalInput,
	ProviderEvent,
	ProviderEventType,
	ProviderFailureKind,
	PurchaseStatusLiteral,
	SeatAwarePaymentProvider,
	SeatProration,
	SetSeatsInput,
} from "./types";
export {
	CheckoutRejectedError,
	failureKindForStatus,
	isProviderRequestError,
	isSeatAware,
	PaymentsDisabledError,
	ProviderRequestError,
	WebhookConfigError,
	WebhookSignatureError,
} from "./types";
export { handlePaymentsWebhook } from "./webhook";
