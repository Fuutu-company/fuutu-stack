/**
 * Billing policy — which subscriptions stack, which replace each other,
 * and which plan checkouts are allowed. Kit defaults come from
 * `Plan.addonOf`; apps refine them through `registerSupersedePolicy` /
 * `registerCheckoutGuard` (`./extensions`).
 */
import {
	getActiveSubscriptionForOrganization,
	getActiveSubscriptionForUser,
	getActiveSubscriptionsForOwner,
	getPurchasesByOrganizationId,
	getPurchasesByUserId,
	type PurchaseOwner,
} from "@fuutu/db";
import { PLANS, type Plan, type PlanId } from "./config";
import { getPlanIdForProductId } from "./config.server";
import {
	type ActivatedSubscription,
	type CheckoutGuardContext,
	type ExistingSubscription,
	getCheckoutGuards,
	getSupersedePolicy,
	type OwnerPurchase,
} from "./extensions";
import { CheckoutRejectedError } from "./types";

// Widened view: the `as const` catalog only carries the keys each plan declares.
const plans: Partial<Record<PlanId, Plan>> = PLANS;

/** Rejection reason when an add-on checkout has no active base plan. */
export const ADDON_REQUIRES_BASE = "addon_requires_base";

export function isAddonPlan(planId: PlanId | null | undefined): boolean {
	return planId ? plans[planId]?.addonOf !== undefined : false;
}

/** Plan of a stored purchase, `null` when its product maps to none. */
export function planIdOfPurchase(purchase: {
	productId: string | null;
	priceId: string;
}): PlanId | null {
	return getPlanIdForProductId(purchase.productId ?? purchase.priceId) ?? null;
}

/** Kit default: plans replace each other, add-ons stack with everything. */
function defaultSupersedes(
	activated: ActivatedSubscription,
	existing: ExistingSubscription,
): boolean {
	return !isAddonPlan(activated.planId) && !isAddonPlan(existing.planId);
}

/** Does `activated` cancel `existing`? Registered policy first, else the default. */
export async function shouldSupersede(
	activated: ActivatedSubscription,
	existing: ExistingSubscription,
): Promise<boolean> {
	const policy = getSupersedePolicy();
	const defaults = () => defaultSupersedes(activated, existing);
	return policy ? await policy(activated, existing, defaults) : defaults();
}

/**
 * The owner's access-gating plan subscription: the newest ACTIVE/TRIALING
 * (or SCHEDULED_CANCEL in period) subscription that is not an add-on.
 * Without add-ons in the catalog this is a single query.
 */
export async function getPlanSubscription(owner: PurchaseOwner) {
	const newest =
		"organizationId" in owner
			? await getActiveSubscriptionForOrganization(owner.organizationId)
			: await getActiveSubscriptionForUser(owner.userId);
	if (!newest || !isAddonPlan(planIdOfPurchase(newest))) return newest;
	const all = await getActiveSubscriptionsForOwner(owner);
	return all.find((sub) => !isAddonPlan(planIdOfPurchase(sub))) ?? null;
}

function grantsAccess(
	purchase: { status: string; currentPeriodEnd: Date | null },
	now: Date,
): boolean {
	if (purchase.status === "ACTIVE" || purchase.status === "TRIALING") {
		return true;
	}
	return (
		purchase.status === "SCHEDULED_CANCEL" &&
		purchase.currentPeriodEnd !== null &&
		purchase.currentPeriodEnd > now
	);
}

export type CheckoutRequest = Omit<CheckoutGuardContext, "existingPurchases">;

/**
 * Run the kit's checkout rules, then every registered guard. Throws
 * `CheckoutRejectedError` when the checkout must not start:
 * - `addon_requires_base`: the plan is an add-on (`Plan.addonOf`) and the
 *   owner holds no access-granting purchase of its base plan.
 */
export async function assertCheckoutAllowed(
	request: CheckoutRequest,
): Promise<void> {
	const { owner } = request;
	const stored =
		"organizationId" in owner
			? await getPurchasesByOrganizationId(owner.organizationId)
			: await getPurchasesByUserId(owner.userId);
	const now = new Date();
	const existingPurchases: OwnerPurchase[] = stored.map((purchase) => ({
		...purchase,
		planId: planIdOfPurchase(purchase),
		grantsAccess: grantsAccess(purchase, now),
	}));

	const baseOf = plans[request.planId]?.addonOf;
	if (
		baseOf &&
		!existingPurchases.some((p) => p.grantsAccess && p.planId === baseOf)
	) {
		throw new CheckoutRejectedError(ADDON_REQUIRES_BASE);
	}

	const ctx: CheckoutGuardContext = { ...request, existingPurchases };
	for (const guard of getCheckoutGuards()) {
		await guard(ctx);
	}
}
