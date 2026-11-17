/**
 * App extension points for billing state — let an app compute or store
 * entitlements its own way without editing sync.ts / entitlements.ts.
 *
 * Kept free of runtime imports so sync.ts and entitlements.ts can both
 * depend on it without an import cycle. Register once at server startup
 * — in the SaaS app: `registerApp()` in `apps/saas/src/server-init.ts`.
 *
 * State lives on `globalThis` (not module scope): Next.js may evaluate
 * this module once per bundle (instrumentation, route handlers, RSC), and
 * a registration made in one bundle must be visible in all of them.
 */
import type { getPurchasesByUserId, PurchaseOwner } from "@fuutu/db";
import type { PlanId } from "./config";
import type { Entitlement } from "./entitlements";

// ─── Entitlement resolver ─────────────────────────────────────────────────────

/** `defaults` runs the kit's live computation — call it to build on it. */
export type EntitlementResolverFn = (
	ownerId: string,
	defaults: () => Promise<Entitlement>,
) => Promise<Entitlement>;

/**
 * Applies wherever the kit reads entitlements: `getOrgEntitlement`,
 * `getUserEntitlement`, `hasFeature`, and the oRPC `authProcedure` plan /
 * subscription / limit gates (tier, planId and limits come from the
 * entitlement). Not covered: direct `resolveActivePlan` / `getPlanLimit`
 * calls in app code — read the entitlement there instead.
 */
export type EntitlementResolver = {
	/** Replaces the computation behind `getOrgEntitlement`. */
	org?: EntitlementResolverFn;
	/** Replaces the personal (no active org) path of `getUserEntitlement`. */
	user?: EntitlementResolverFn;
};

// Bundle-shared state (see header).
interface ExtensionRegistry {
	entitlementResolver: EntitlementResolver | null;
	purchaseChangedHandlers: Set<PurchaseChangedHandler>;
	supersedePolicy?: SupersedePolicy | null;
	checkoutGuards?: Set<CheckoutGuard>;
	trialEligibilityPolicy?: TrialEligibilityPolicy | null;
	seatGate?: SeatGate | null;
}

const REGISTRY_KEY = Symbol.for("fuutu.payments.extensions");

function registry(): ExtensionRegistry {
	const scope = globalThis as typeof globalThis & {
		[REGISTRY_KEY]?: ExtensionRegistry;
	};
	scope[REGISTRY_KEY] ??= {
		entitlementResolver: null,
		purchaseChangedHandlers: new Set(),
	};
	return scope[REGISTRY_KEY];
}

/**
 * Replace the default live entitlement computation for the scopes the
 * resolver covers; uncovered scopes keep the default. `null` restores
 * the default everywhere. Only one resolver is active at a time.
 */
export function registerEntitlementResolver(
	resolver: EntitlementResolver | null,
): void {
	registry().entitlementResolver = resolver;
}

export function getEntitlementResolver(): EntitlementResolver | null {
	return registry().entitlementResolver;
}

// ─── Purchase-changed callback ────────────────────────────────────────────────

export type PurchaseChangedHandler = (
	owner: PurchaseOwner,
) => void | Promise<void>;

/**
 * Run `handler` after webhook sync writes a purchase for an owner. A
 * thrown error fails the webhook delivery (5xx → provider retry), and
 * redeliveries re-notify — handlers must be idempotent. Outgoing webhook
 * events (`subscription.created`, `invoice.paid`) are emitted before the
 * handlers run, so a failing handler never suppresses them. Returns an
 * unsubscribe function.
 */
export function onPurchaseChanged(handler: PurchaseChangedHandler): () => void {
	const { purchaseChangedHandlers } = registry();
	purchaseChangedHandlers.add(handler);
	return () => {
		purchaseChangedHandlers.delete(handler);
	};
}

/** Invoke every registered handler in registration order. */
export async function notifyPurchaseChanged(
	userId: string | null,
	organizationId: string | null,
): Promise<void> {
	const owner: PurchaseOwner | null = organizationId
		? { organizationId }
		: userId
			? { userId }
			: null;
	if (!owner) return;
	for (const handler of registry().purchaseChangedHandlers) {
		await handler(owner);
	}
}

// ─── Supersede policy ─────────────────────────────────────────────────────────

/** The subscription whose activation is being processed. */
export type ActivatedSubscription = {
	/** `null` when the product maps to no plan in `PLANS`. */
	planId: PlanId | null;
	productId: string;
	subscriptionId: string;
	owner: PurchaseOwner;
};

/** Another ACTIVE/TRIALING subscription of the same owner. */
export type ExistingSubscription = {
	planId: PlanId | null;
	productId: string | null;
	subscriptionId: string;
	purchaseId: string;
	status: string;
};

/**
 * `true` = the activation supersedes `existing`: the kit cancels it at its
 * provider and marks it CANCELED. `defaults` returns the kit decision —
 * plans replace each other, add-ons (`Plan.addonOf`) stack: they never
 * cancel and are never canceled. Throwing fails the webhook delivery
 * (5xx → provider retry) before the new subscription is recorded.
 */
export type SupersedePolicy = (
	activated: ActivatedSubscription,
	existing: ExistingSubscription,
	defaults: () => boolean,
) => boolean | Promise<boolean>;

/**
 * Decide which of an owner's other active subscriptions a new activation
 * cancels. One policy at a time; `null` restores the kit default.
 *
 * Runs on activations only — nothing cascades when a base subscription
 * ends, so its add-ons keep running. Return `true` for `existing` add-ons
 * of a replaced base here, or cancel orphaned add-ons in an
 * `onPurchaseChanged` handler.
 */
export function registerSupersedePolicy(policy: SupersedePolicy | null): void {
	registry().supersedePolicy = policy;
}

export function getSupersedePolicy(): SupersedePolicy | null {
	return registry().supersedePolicy ?? null;
}

// ─── Checkout guard ───────────────────────────────────────────────────────────

type StoredPurchase = Awaited<ReturnType<typeof getPurchasesByUserId>>[number];

/** A purchase of the checkout owner, with its plan resolved. */
export type OwnerPurchase = StoredPurchase & {
	/** `null` when the product maps to no plan (e.g. a credit top-up). */
	planId: PlanId | null;
	/** Grants access now: ACTIVE/TRIALING, or SCHEDULED_CANCEL in its period. */
	grantsAccess: boolean;
};

export type CheckoutGuardContext = {
	/** Who the purchase will belong to (organization when one is passed). */
	owner: PurchaseOwner;
	/** The signed-in user starting the checkout. */
	userId: string;
	planId: PlanId;
	interval: "month" | "year";
	seats?: number;
	/** The caller asked to buy now, without the plan's trial. */
	skipTrial: boolean;
	/**
	 * Whether this checkout gets the plan's trial (`Plan.trialDays`,
	 * `Plan.trialOnce`, `skipTrial`, `registerTrialEligibilityPolicy`).
	 */
	trial: boolean;
	/** Every purchase of `owner`, newest first. */
	existingPurchases: readonly OwnerPurchase[];
	/**
	 * Every purchase `userId` checked out — their own and organizations'
	 * (`metadata.user_id`), newest first. Rows of deleted organizations
	 * are gone with them.
	 */
	checkoutUserPurchases: readonly OwnerPurchase[];
};

/**
 * Throw `CheckoutRejectedError` (from `@fuutu/payments`) to refuse a plan
 * checkout — `payments.checkout.create` answers PRECONDITION_FAILED with
 * `data.reason` and never calls the provider. Any other error fails the
 * request generically (500).
 */
export type CheckoutGuard = (ctx: CheckoutGuardContext) => void | Promise<void>;

/**
 * Add a guard run before every plan checkout, after the kit's own checks
 * (an add-on needs an active base). Guards run in registration order.
 * Returns an unsubscribe function.
 */
export function registerCheckoutGuard(guard: CheckoutGuard): () => void {
	const scope = registry();
	scope.checkoutGuards ??= new Set();
	const guards = scope.checkoutGuards;
	guards.add(guard);
	return () => {
		guards.delete(guard);
	};
}

export function getCheckoutGuards(): CheckoutGuard[] {
	return [...(registry().checkoutGuards ?? [])];
}

// ─── Trial eligibility ────────────────────────────────────────────────────────

/** The checkout being decided — the guard context without its outcome. */
export type TrialEligibilityContext = Omit<CheckoutGuardContext, "trial">;

/**
 * `true` = this checkout gets the plan's trial. `defaults` returns the kit
 * decision: no earlier purchase of the plan by the owner nor by the
 * checkout user (`checkoutUserPurchases`), unless the plan sets
 * `trialOnce: false` (then always). Consulted only when the plan has
 * `trialDays` and the caller did not pass `skipTrial` — it can deny a
 * trial, never add one the plan does not offer.
 */
export type TrialEligibilityPolicy = (
	ctx: TrialEligibilityContext,
	defaults: () => boolean,
) => boolean | Promise<boolean>;

/**
 * Decide which plan checkouts get the trial (e.g. once per user across
 * their organizations). Runs before the checkout guards, which see the
 * result as `ctx.trial`. One policy at a time; `null` restores the kit
 * default. Throwing `CheckoutRejectedError` refuses the checkout like a
 * guard; any other error fails it generically (500).
 */
export function registerTrialEligibilityPolicy(
	policy: TrialEligibilityPolicy | null,
): void {
	registry().trialEligibilityPolicy = policy;
}

export function getTrialEligibilityPolicy(): TrialEligibilityPolicy | null {
	return registry().trialEligibilityPolicy ?? null;
}

// ─── Seat gate ────────────────────────────────────────────────────────────────

/** A membership change the seat limit is checked for. */
export type SeatGateContext = {
	organizationId: string;
	/** Seats in use: members, plus pending invitations for `"invitation"`. */
	usedSeats: number;
	/** The entitlement's seat cap (`null` = unlimited). */
	seatsTotal: number | null;
	/** `"member"`: direct add / invitation accept; `"invitation"`: invite. */
	purpose: "member" | "invitation";
};

/**
 * The seat cap for this change (`null` = unlimited) — the change is
 * refused (402) when `usedSeats` reaches it. `defaults` returns the kit
 * cap, the entitlement's `seatsTotal`.
 */
export type SeatGate = (
	ctx: SeatGateContext,
	defaults: () => number | null,
) => number | null | Promise<number | null>;

/**
 * Decide the seat cap for new members and invitations (e.g. seats bought
 * per organization outside the plan). Runs in the Better Auth organization
 * hooks (`@fuutu/auth` seat-limit). One gate at a time; `null` restores
 * the kit default (`seatsTotal`).
 */
export function registerSeatGate(gate: SeatGate | null): void {
	registry().seatGate = gate;
}

export function getSeatGate(): SeatGate | null {
	return registry().seatGate ?? null;
}
