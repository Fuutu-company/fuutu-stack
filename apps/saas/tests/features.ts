import { config } from "@fuutu/config";
import { paymentsConfig } from "@fuutu/payments/config";

/**
 * Kit modules a `config.features` flag switches off — their pages answer
 * 404 (`src/lib/feature-routes.ts`). A spec of one module skips itself
 * when it is off, so an app that ships it off needs no `app-excluded`
 * entry.
 */
const orgsOn = config.features.organizationsMode !== "off";

const FEATURES = {
	aiChat: { enabled: config.features.aiChat, routes: ["/chat"] },
	// CRM contacts belong to an organization: without organizations the
	// page only says so.
	crm: { enabled: config.features.crm && orgsOn, routes: ["/crm"] },
	credits: {
		enabled: paymentsConfig.creditsEnabled,
		routes: ["/settings/credits"],
	},
	webhooks: {
		enabled: config.features.webhooks,
		routes: ["/settings/webhooks"],
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
 * owns it (personal or `/organizations/<slug>/…`), and for every
 * `/organizations…` route without organizations.
 */
export function routeOff(route: string): [boolean, string] {
	if (!orgsOn && /^\/organizations(\/|$|\?)/.test(route)) return orgsOff();
	const path = route.split("?")[0]?.replace(ORG_PREFIX, "") ?? route;
	for (const feature of Object.keys(FEATURES) as GatedFeature[]) {
		const owns = FEATURES[feature].routes.some(
			(prefix) => path === prefix || path.startsWith(`${prefix}/`),
		);
		if (owns) return featureOff(feature);
	}
	return [false, ""];
}

/** Provider credential the billing pages need before they load purchases. */
const PAYMENT_CREDENTIAL: Record<string, string | undefined> = {
	creem: "CREEM_API_KEY",
	stripe: "STRIPE_SECRET_KEY",
	polar: "POLAR_ACCESS_TOKEN",
};

/**
 * `test.skip` arguments for a test that needs the billing pages to load
 * subscriptions and purchases: they pass `paymentsEnabled=false` without
 * the active provider's credential, which kit CI does not set.
 */
export function paymentsUnconfigured(): [boolean, string] {
	const key = PAYMENT_CREDENTIAL[paymentsConfig.provider];
	return [
		key ? !process.env[key] : paymentsConfig.provider === "noop",
		`no ${key ?? paymentsConfig.provider} credential for the payment provider`,
	];
}
