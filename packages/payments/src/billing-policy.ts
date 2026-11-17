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
	getPurchasesCheckedOutByUser,
	type PurchaseOwner,
} from "@fuutu/db";
import { PLANS, type Plan, type PlanId } from "./config";
import { getPlanForProductId, getPlanIdForProductId } from "./config.server";
import {
	type ActivatedSubscription,
	type CheckoutGuardContext,
	type ExistingSubscription,
	getCheckoutGuards,
	getSupersedePolicy,
	getTrialEligibilityPolicy,
	type OwnerPurchase,
	type TrialEligibilityContext,
} from "./extensions";
import { CheckoutRejectedError } from "./types";

// Widened view: the `as const` catalog only carries the keys each plan declares.
const plans: Partial<Record<PlanId, Plan>> = PLANS;

/** Rejection reason when an add-on checkout has no active base plan. */
export const ADDON_REQUIRES_BASE = "addon_requires_base";

/**
 * Rejection reason when the owner already pays for this plan at this
 * interval — a second checkout would charge twice (the activation then
 * cancels the first subscription without a refund).
 */
export const ALREADY_SUBSCRIBED = "already_subscribed";

/**
 * Rejection reason when the owner's subscription of this plan and interval
 * is still in its period but set to cancel at period end — resuming it is
 * the right move, not a second checkout.
 */
export const RESUME_INSTEAD = "resume_instead";

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

export type CheckoutRequest = Omit<
	CheckoutGuardContext,
	"existingPurchases" | "checkoutUserPurchases" | "trial" | "skipTrial"
> & {
	/** Buy now without the plan's trial. Default false. */
	skipTrial?: boolean;
};

/** What an allowed checkout gets. */
export type CheckoutDecision = {
	/** Start the plan's trial (`Plan.trialDays`) with this checkout. */
	trial: boolean;
};

/**
 * Kit trial rule: once (`Plan.trialOnce` unset or true) = no earlier
 * purchase of the plan by the owner, nor by the checkout user anywhere
 * (another org, personally). `trialOnce: false` = a trial every checkout.
 */
function defaultTrialEligible(ctx: TrialEligibilityContext): boolean {
	const plan = plans[ctx.planId];
	if (plan?.trialOnce === false) return true;
	const ofPlan = (p: OwnerPurchase) => p.planId === ctx.planId;
	return (
		!ctx.existingPurchases.some(ofPlan) &&
		!ctx.checkoutUserPurchases.some(ofPlan)
	);
}

async function decideTrial(ctx: TrialEligibilityContext): Promise<boolean> {
	const plan = plans[ctx.planId];
	const trialDays = plan?.billingType === "subscription" ? plan.trialDays : 0;
	if (!trialDays || trialDays <= 0 || ctx.skipTrial) {
		return false;
	}
	const policy = getTrialEligibilityPolicy();
	const defaults = () => defaultTrialEligible(ctx);
	return policy ? await policy(ctx, defaults) : defaults();
}

/**
 * Run the kit's checkout rules, decide the trial, then run every
 * registered guard (they see the decision as `ctx.trial`). Throws
 * `CheckoutRejectedError` when the checkout must not start:
 * - `addon_requires_base`: the plan is an add-on (`Plan.addonOf`) and the
 *   owner holds no access-granting purchase of its base plan.
 * - `already_subscribed`: the owner already pays for this plan at this
 *   interval (ACTIVE). A trial of it may be converted; add-ons may stack.
 * - `resume_instead`: the same, but the subscription is SCHEDULED_CANCEL
 *   in its period — resume it in billing.
 */
export async function assertCheckoutAllowed(
	request: CheckoutRequest,
): Promise<CheckoutDecision> {
	const { owner } = request;
	const stored =
		"organizationId" in owner
			? await getPurchasesByOrganizationId(owner.organizationId)
			: await getPurchasesByUserId(owner.userId);
	const now = new Date();
	const toOwnerPurchase = (purchase: (typeof stored)[number]) => ({
		...purchase,
		planId: planIdOfPurchase(purchase),
		grantsAccess: grantsAccess(purchase, now),
	});
	const existingPurchases: OwnerPurchase[] = stored.map(toOwnerPurchase);

	const baseOf = plans[request.planId]?.addonOf;
	if (
		baseOf &&
		!existingPurchases.some((p) => p.grantsAccess && p.planId === baseOf)
	) {
		throw new CheckoutRejectedError(ADDON_REQUIRES_BASE);
	}

	if (!baseOf) {
		const samePlan = existingPurchases.filter(
			(p) =>
				p.planId === request.planId &&
				p.grantsAccess &&
				p.status !== "TRIALING" &&
				getPlanForProductId(p.productId ?? p.priceId)?.interval ===
					request.interval,
		);
		if (samePlan.length > 0) {
			throw new CheckoutRejectedError(
				samePlan.every((p) => p.status === "SCHEDULED_CANCEL")
					? RESUME_INSTEAD
					: ALREADY_SUBSCRIBED,
			);
		}
	}

	const checkoutUserPurchases: OwnerPurchase[] = (
		await getPurchasesCheckedOutByUser(request.userId)
	).map(toOwnerPurchase);
	const trialCtx: TrialEligibilityContext = {
		...request,
		skipTrial: request.skipTrial ?? false,
		existingPurchases,
		checkoutUserPurchases,
	};
	const trial = await decideTrial(trialCtx);
	const ctx: CheckoutGuardContext = { ...trialCtx, trial };
	for (const guard of getCheckoutGuards()) {
		await guard(ctx);
	}
	return { trial };
}
