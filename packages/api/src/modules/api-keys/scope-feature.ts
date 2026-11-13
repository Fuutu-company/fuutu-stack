import { env } from "@fuutu/env/saas";
import { getOrgEntitlement } from "@fuutu/payments";
import { apiConfig } from "../../config";

export type MissingScopeFeature = { feature: string; upgradeUrl: string };

/**
 * Per-scope feature gate from `apiConfig.apiKeyScopeFeatures`. Returns
 * the missing feature (→ 402 upgrade_required) or `null` when the scope
 * is ungated or the org's entitlement includes it. Without an org
 * (personal key) there is no entitlement to check — a gated scope fails
 * closed.
 */
export async function findMissingScopeFeature(
	organizationId: string | null,
	scope: string,
): Promise<MissingScopeFeature | null> {
	const feature = apiConfig.apiKeyScopeFeatures[scope];
	if (!feature) return null;
	if (organizationId) {
		const entitlement = await getOrgEntitlement(organizationId);
		if (entitlement.features.includes(feature)) return null;
	}
	const upgradeUrl = env.NEXT_PUBLIC_MARKETING_URL
		? `${env.NEXT_PUBLIC_MARKETING_URL}/pricing`
		: "/pricing";
	return { feature, upgradeUrl };
}
