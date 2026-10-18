import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Marketing-only env surface.
 *
 * Exposes ONLY public `NEXT_PUBLIC_*` variables — no DB, auth, payments,
 * storage, or mail secrets. This guarantees that `apps/marketing` can never
 * accidentally import server-only secrets (compile-time error) and keeps the
 * public bundle clean.
 *
 * Rule: any server-side secret used in marketing must first be exposed via
 * a public `NEXT_PUBLIC_*` proxy, or the feature must move to `apps/saas`.
 */
export const env = createEnv({
	server: {},
	shared: {
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
	},
	client: {
		NEXT_PUBLIC_MARKETING_URL: z.string().url().optional(),
		NEXT_PUBLIC_SAAS_URL: z.string().url().optional(),
		NEXT_PUBLIC_DOCS_URL: z.string().url().optional(),

		NEXT_PUBLIC_ANALYTICS_PROVIDER: z
			.enum(["umami", "plausible", "pirsch", "mixpanel", "ga4", "noop"])
			.optional(),
		NEXT_PUBLIC_ANALYTICS_REQUIRE_CONSENT: z
			.enum(["0", "1", "true", "false"])
			.optional()
			.transform((v) =>
				v === undefined ? undefined : v === "1" || v === "true",
			),
		NEXT_PUBLIC_ANALYTICS_SHOW_CONSENT_BANNER: z
			.enum(["0", "1", "true", "false"])
			.optional()
			.transform((v) =>
				v === undefined ? undefined : v === "1" || v === "true",
			),
		NEXT_PUBLIC_ANALYTICS_CONSENT_DOMAIN: z.string().optional(),
		NEXT_PUBLIC_UMAMI_WEBSITE_ID: z.string().optional(),
		NEXT_PUBLIC_UMAMI_SCRIPT_URL: z.string().url().optional(),
	},
	runtimeEnv: {
		NODE_ENV: process.env.NODE_ENV,
		NEXT_PUBLIC_MARKETING_URL: process.env.NEXT_PUBLIC_MARKETING_URL,
		NEXT_PUBLIC_SAAS_URL: process.env.NEXT_PUBLIC_SAAS_URL,
		NEXT_PUBLIC_DOCS_URL: process.env.NEXT_PUBLIC_DOCS_URL,

		NEXT_PUBLIC_ANALYTICS_PROVIDER: process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER,
		NEXT_PUBLIC_ANALYTICS_REQUIRE_CONSENT:
			process.env.NEXT_PUBLIC_ANALYTICS_REQUIRE_CONSENT,
		NEXT_PUBLIC_ANALYTICS_SHOW_CONSENT_BANNER:
			process.env.NEXT_PUBLIC_ANALYTICS_SHOW_CONSENT_BANNER,
		NEXT_PUBLIC_ANALYTICS_CONSENT_DOMAIN:
			process.env.NEXT_PUBLIC_ANALYTICS_CONSENT_DOMAIN,
		NEXT_PUBLIC_UMAMI_WEBSITE_ID: process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID,
		NEXT_PUBLIC_UMAMI_SCRIPT_URL: process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL,
	},
	emptyStringAsUndefined: true,
});
