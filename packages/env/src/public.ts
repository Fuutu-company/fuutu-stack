import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Cookie-domain shape for NEXT_PUBLIC_ANALYTICS_CONSENT_DOMAIN —
 * shared by public.ts, saas.ts, marketing.ts and docs.ts so every
 * app validates identically.
 */
export const cookieDomainSchema = z
	.string()
	.max(253)
	.regex(
		/^\.?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i,
	)
	.optional();

/**
 * Shared env surface for the public apps (marketing + docs).
 *
 * Exposes ONLY public `NEXT_PUBLIC_*` variables — no DB, auth, payments,
 * storage, or mail secrets — so a public app can never import server-only
 * secrets (compile-time error). Add new public vars here exactly once;
 * marketing.ts and docs.ts spread this into their own `createEnv` call.
 */
export const publicEnvOptions = {
	shared: {
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
	},
	client: {
		NEXT_PUBLIC_MARKETING_URL: z.url().optional(),
		NEXT_PUBLIC_SAAS_URL: z.url().optional(),
		NEXT_PUBLIC_DOCS_URL: z.url().optional(),
		NEXT_PUBLIC_ANALYTICS_PROVIDER: z
			.enum(["umami", "plausible", "pirsch", "mixpanel", "ga4", "noop"])
			.optional(),
		NEXT_PUBLIC_ANALYTICS_REQUIRE_CONSENT: z.stringbool().optional(),
		NEXT_PUBLIC_ANALYTICS_SHOW_CONSENT_BANNER: z.stringbool().optional(),
		NEXT_PUBLIC_ANALYTICS_CONSENT_DOMAIN: cookieDomainSchema,
		NEXT_PUBLIC_UMAMI_WEBSITE_ID: z.string().optional(),
		NEXT_PUBLIC_UMAMI_SCRIPT_URL: z.url().optional(),
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
};

/**
 * Client-bundle-safe env — exposes ONLY public `NEXT_PUBLIC_*` vars.
 * Use this in modules shared between server and client (e.g.
 * `@fuutu/auth/redirect`) where importing `@fuutu/env/saas` would
 * pull server-only secrets into the client bundle.
 */
export const env = createEnv({
	server: {},
	...publicEnvOptions,
	emptyStringAsUndefined: true,
});
