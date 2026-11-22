import { config } from "@fuutu/config";
import { paymentsConfig } from "@fuutu/payments/config";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

/**
 * Route prefixes of the modules a `config.features` flag switches off,
 * personal and org-scoped (`/organizations/<slug>/…`). The API side of
 * the same flags: `featureRouter` in `@fuutu/api`.
 */
const FEATURE_ROUTES = {
	aiChat: { enabled: () => config.features.aiChat, routes: ["/chat"] },
	// CRM contacts belong to an organization: off without organizations.
	crm: {
		enabled: () =>
			config.features.crm && config.features.organizationsMode !== "off",
		routes: ["/crm"],
	},
	credits: {
		enabled: () => paymentsConfig.creditsEnabled,
		routes: ["/settings/credits"],
	},
	designSystem: {
		enabled: () => config.features.designSystem,
		routes: ["/design"],
		personalOnly: true,
	},
	// Org-scoped page: matches `/organizations/<slug>/settings/webhooks`.
	webhooks: {
		enabled: () => config.features.webhooks,
		routes: ["/settings/webhooks"],
	},
	// Personal billing only exists while billing is attached to users;
	// `/organizations/<slug>/settings/billing` stays reachable.
	personalBilling: {
		enabled: () => paymentsConfig.billingAttachedTo === "user",
		routes: ["/settings/billing"],
		personalOnly: true,
	},
	desktop: {
		enabled: () => config.features.desktop,
		routes: ["/settings/desktop"],
		personalOnly: true,
	},
	// `organizationsMode: "off"`: every `/organizations…` route (checked
	// before the org prefix is stripped, see `disabledFeatureForPath`).
	organizations: {
		enabled: () => config.features.organizationsMode !== "off",
		routes: ["/organizations"],
	},
} satisfies Record<
	string,
	{ enabled: () => boolean; routes: string[]; personalOnly?: boolean }
>;

export type GatedRouteFeature = keyof typeof FEATURE_ROUTES;

const ORG_PREFIX = /^\/organizations\/[^/]+(?=\/)/;

function within(pathname: string, prefix: string): boolean {
	return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** The switched-off feature that owns `pathname`, or `null`. */
export function disabledFeatureForPath(
	pathname: string,
): GatedRouteFeature | null {
	if (
		!FEATURE_ROUTES.organizations.enabled() &&
		within(pathname, "/organizations")
	) {
		return "organizations";
	}
	const orgPath = pathname.replace(ORG_PREFIX, "");
	const inOrg = orgPath !== pathname;
	for (const [feature, entry] of Object.entries(FEATURE_ROUTES) as [
		GatedRouteFeature,
		(typeof FEATURE_ROUTES)[GatedRouteFeature],
	][]) {
		if (entry.enabled()) continue;
		if (inOrg && "personalOnly" in entry) continue;
		const path = inOrg ? orgPath : pathname;
		if (entry.routes.some((route) => within(path, route))) return feature;
	}
	return null;
}

/**
 * 404 a switched-off module's route. Call it in a layout ABOVE every
 * `loading.tsx` — there the 404 status is still sendable; a page-level
 * `notFound()` under a Suspense fallback streams with status 200. Reads
 * the pathname the proxy forwards (`x-pathname`); without it the pages'
 * own `notFound()` still applies.
 */
export async function notFoundIfFeatureOff(): Promise<void> {
	const pathname = (await headers()).get("x-pathname");
	if (pathname && disabledFeatureForPath(pathname)) notFound();
}
