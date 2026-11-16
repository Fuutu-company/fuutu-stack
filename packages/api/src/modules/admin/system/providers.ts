import { aiConfig } from "@fuutu/ai/config";
import { env } from "@fuutu/env/saas";
import { logsConfig } from "@fuutu/logs";
import { paymentsConfig } from "@fuutu/payments/config";
import { storageConfig } from "@fuutu/storage/config";

export type ProviderDomain =
	| "mail"
	| "payments"
	| "storage"
	| "analytics"
	| "logs"
	| "ai";

export type ProviderStatus = {
	domain: ProviderDomain;
	/** The active provider's id — never a URL or a credential. */
	provider: string;
	/** True when the provider can do real work with the credentials present. */
	configured: boolean;
};

// Same defaults as the domain packages' resolvers.
const DEFAULT_MAIL_PROVIDER = "plunk";
const DEFAULT_ANALYTICS_PROVIDER = "umami";

const present = (...values: (string | undefined)[]) =>
	values.every((value) => Boolean(value));

function mailConfigured(provider: string): boolean {
	switch (provider) {
		case "plunk":
			return present(env.PLUNK_API_KEY);
		case "resend":
			return present(env.RESEND_API_KEY);
		default:
			// console/noop deliver nothing; the other providers are skeletons.
			return false;
	}
}

function paymentsConfigured(provider: string): boolean {
	switch (provider) {
		case "creem":
			return present(env.CREEM_API_KEY, env.CREEM_WEBHOOK_SECRET);
		case "stripe":
			return present(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET);
		case "polar":
			return present(env.POLAR_ACCESS_TOKEN, env.POLAR_WEBHOOK_SECRET);
		case "custom":
			return paymentsConfig.customProvider !== undefined;
		default:
			return false;
	}
}

function storageConfigured(provider: string): boolean {
	return (
		provider === "s3" && present(env.S3_ACCESS_KEY_ID, env.S3_SECRET_ACCESS_KEY)
	);
}

function analyticsConfigured(provider: string): boolean {
	return provider === "umami" && present(env.NEXT_PUBLIC_UMAMI_WEBSITE_ID);
}

function aiConfigured(provider: string): boolean {
	switch (provider) {
		case "openrouter":
			return present(env.AI_API_KEY);
		case "google":
			return present(env.AI_API_KEY ?? env.GOOGLE_GENERATIVE_AI_API_KEY);
		default:
			return false;
	}
}

const DRAIN_CREDENTIALS: Record<string, () => boolean> = {
	sentry: () => present(env.SENTRY_DSN),
	axiom: () => present(env.AXIOM_TOKEN, env.AXIOM_DATASET),
};

/** Console is always on; extra drains count once their credentials exist. */
function logsStatus(): ProviderStatus {
	const drains = logsConfig.drains;
	return {
		domain: "logs",
		provider: ["console", ...drains].join(", "),
		configured: drains.every((drain) => DRAIN_CREDENTIALS[drain]?.() ?? true),
	};
}

/**
 * Active provider and a "configured" flag per swappable domain. Only
 * ids and booleans leave this function: credentials, endpoints and DSNs
 * stay in the environment.
 */
export function getProviderStatuses(): ProviderStatus[] {
	const mail = env.EMAIL_PROVIDER ?? DEFAULT_MAIL_PROVIDER;
	const payments = paymentsConfig.provider;
	const storage = storageConfig.provider;
	const analytics =
		env.NEXT_PUBLIC_ANALYTICS_PROVIDER ?? DEFAULT_ANALYTICS_PROVIDER;
	const ai = aiConfig.provider;
	return [
		{ domain: "mail", provider: mail, configured: mailConfigured(mail) },
		{
			domain: "payments",
			provider: payments,
			configured: paymentsConfigured(payments),
		},
		{
			domain: "storage",
			provider: storage,
			configured: storageConfigured(storage),
		},
		{
			domain: "analytics",
			provider: analytics,
			configured: analyticsConfigured(analytics),
		},
		logsStatus(),
		{ domain: "ai", provider: ai, configured: aiConfigured(ai) },
	];
}
