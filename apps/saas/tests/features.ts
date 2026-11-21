import { config } from "@fuutu/config";
import { paymentsConfig } from "@fuutu/payments/config";

/**
 * Kit modules a `config.features` flag switches off — their pages answer
 * 404 (`src/lib/feature-routes.ts`). A spec of one module skips itself
 * when it is off, so an app that ships it off needs no `app-excluded`
 * entry.
 */
const FEATURES = {
	aiChat: { enabled: config.features.aiChat, routes: ["/chat"] },
	crm: { enabled: config.features.crm, routes: ["/crm"] },
	credits: {
		enabled: paymentsConfig.creditsEnabled,
		routes: ["/settings/credits"],
	},
	webhooks: {
		enabled: config.features.webhooks,
		routes: ["/settings/webhooks"],
	},
	desktop: {
		enabled: config.features.desktop,
		routes: ["/settings/desktop"],
	},
} as const;

export type GatedFeature = keyof typeof FEATURES;

/**
 * `test.skip` arguments for a test that needs organizations
 * (`organizationsMode` "off" in a B2C app): `test.skip(...orgsOff())`.
 */
export function orgsOff(): [boolean, string] {
	return [
		config.features.organizationsMode === "off",
		'config.features.organizationsMode is "off"',
	];
}

/** True when a gated module is on (`config.features.<feature>`). */
export function featureOn(feature: GatedFeature): boolean {
	return FEATURES[feature].enabled;
}

/** `test.skip` arguments for a spec of one module: `test.skip(...featureOff("crm"))`. */
export function featureOff(feature: GatedFeature): [boolean, string] {
	return [!FEATURES[feature].enabled, `config.features.${feature} is off`];
}

const ORG_PREFIX = /^\/organizations\/[^/]+(?=\/)/;

/**
 * `test.skip` arguments for a route: skipped when a switched-off module
 * owns it (personal or `/organizations/<slug>/…`).
 */
export function routeOff(route: string): [boolean, string] {
	const path = route.split("?")[0]?.replace(ORG_PREFIX, "") ?? route;
	for (const feature of Object.keys(FEATURES) as GatedFeature[]) {
		const owns = FEATURES[feature].routes.some(
			(prefix) => path === prefix || path.startsWith(`${prefix}/`),
		);
		if (owns) return featureOff(feature);
	}
	return [false, ""];
}
