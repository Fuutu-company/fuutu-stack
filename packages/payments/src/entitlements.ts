/**
 * Entitlement resolution — owner-scoped "what can this account do" answers.
 *
 * There is no entitlement table: the polymorphic Purchase rows
 * (userId XOR organizationId) stay the source of truth and resolve live
 * through `resolveActivePlan`. Server-only — that path imports
 * config.server (env) and @fuutu/db.
 */

import { LIMITS, type PlanId, type PlanLimits, type PlanTier } from "./config";
import { getFeaturesForTier, planIdToTier } from "./features";
import { resolveActivePlan } from "./plan-resolver";

export type EntitlementScope = "user" | "organization";

export type Entitlement = {
	scope: EntitlementScope;
	ownerId: string;
	planId: PlanId;
	tier: PlanTier;
	/** Flat feature ids (e.g. "api_webhooks") unlocked at this tier. */
	features: string[];
	/** Per-resource caps for the resolved plan — LIMITS[planId]. */
	limits: PlanLimits;
};

function toEntitlement(
	scope: EntitlementScope,
	ownerId: string,
	planId: PlanId,
): Entitlement {
	const tier = planIdToTier(planId);
	return {
		scope,
		ownerId,
		planId,
		tier,
		features: getFeaturesForTier(tier).map((f) => f.id),
		limits: LIMITS[planId],
	};
}

/**
 * Resolve an organization's own entitlement from its active subscription
 * purchase. The org's members are never consulted — org billing is
 * authoritative. Falls back to the "free" plan when the org has no
 * active purchase.
 */
export async function getOrgEntitlement(
	organizationId: string,
): Promise<Entitlement> {
	const { planId } = await resolveActivePlan(null, organizationId);
	return toEntitlement("organization", organizationId, planId);
}

/**
 * Resolve the entitlement that applies to a user right now.
 *
 * Precedence:
 *  1. `opts.activeOrganizationId` provided → the organization's
 *     entitlement wins (org billing governs activity inside that org,
 *     even when the user also holds a personal purchase).
 *  2. The user's own active purchase → personal entitlement.
 *  3. "free" plan fallback when the resolved owner has no active
 *     subscription.
 */
export async function getUserEntitlement(
	userId: string,
	opts?: { activeOrganizationId?: string | null },
): Promise<Entitlement> {
	const organizationId = opts?.activeOrganizationId ?? null;
	if (organizationId) {
		return getOrgEntitlement(organizationId);
	}
	const { planId } = await resolveActivePlan(userId, null);
	return toEntitlement("user", userId, planId);
}

/**
 * Feature check for an owner. When both ids are given the organization
 * wins — same precedence as getUserEntitlement. Returns false when no
 * owner is resolvable.
 */
export async function hasFeature(
	owner: { userId?: string; organizationId?: string },
	feature: string,
): Promise<boolean> {
	const entitlement = owner.organizationId
		? await getOrgEntitlement(owner.organizationId)
		: owner.userId
			? await getUserEntitlement(owner.userId)
			: null;
	return entitlement?.features.includes(feature) ?? false;
}
