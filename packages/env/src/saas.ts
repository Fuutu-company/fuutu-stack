import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { appClientEnv, appClientRuntimeEnv, appServerEnv } from "./app-env";
import { mergeAppEnv } from "./merge-app-env";
import { cookieDomainSchema } from "./public";

// Must stay in sync with packages/logs/src/config.ts — @fuutu/logs reads
// process.env.LOG_DRAIN/LOG_AUDIT_SINK/LOG_LEVEL/SERVICE_NAME directly
// (documented exception), this schema is the app-facing validation for
// the same vars.
const LOG_DRAIN_VALUES = ["console", "sentry", "axiom", "fs", "memory"];

// Dangerous opt-in flags accept only explicit "1"/"true"/"0"/"false" —
// a stray "on"/"yes"/"enabled" must not silently relax SSRF protection
// or disable rate limiting.
const strictFlag = () =>
	z.stringbool({ truthy: ["1", "true"], falsy: ["0", "false"] });

const isProduction = () => process.env.NODE_ENV === "production";

// Published in `.env.example` and CI until 2026-10-11 — anyone can sign
// session cookies with it. Rotate if a deployment ever used it.
const LEAKED_AUTH_SECRETS: ReadonlySet<string> = new Set([
	"gVq2v3iiw7jd5dggl/z6Vk1iPqUMhMinbKq56R/Z6x8=",
]);

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set([
	"localhost",
	"127.0.0.1",
	"[::1]",
]);

const kitServerEnv = {
	DATABASE_URL: z.url(),
	// Selects the Redis rate-limit store when set — driver is a stub
	// until implemented, see @fuutu/utils/rate-limit.
	REDIS_URL: z.url().optional(),
	BETTER_AUTH_SECRET: z
		.string()
		.min(32)
		.refine((v) => !isProduction() || v.trim().length >= 32, {
			message: "BETTER_AUTH_SECRET needs 32+ characters in production",
		})
		.refine((v) => !isProduction() || !LEAKED_AUTH_SECRETS.has(v.trim()), {
			message:
				"BETTER_AUTH_SECRET is a published value — generate a new one (openssl rand -base64 32)",
		}),
	// https in production; plain http only on loopback (CI's `next start`).
	BETTER_AUTH_URL: z.url().refine(
		(v) => {
			if (!isProduction()) return true;
			const url = new URL(v);
			return url.protocol === "https:" || LOOPBACK_HOSTS.has(url.hostname);
		},
		{ message: "BETTER_AUTH_URL must be https in production" },
	),
	// CORS origin for the Hono API — must be a concrete URL, never "*"
	// (the API sends credentials; "*" + credentials is an invalid and
	// dangerous combination that browsers reject anyway). URL
	// validation already rejects "*". Unset in production: the app's own
	// origin (BETTER_AUTH_URL), never a localhost default.
	CORS_ORIGIN: z
		.url()
		.optional()
		.default(() => {
			const appUrl = process.env.BETTER_AUTH_URL;
			if (isProduction() && appUrl && URL.canParse(appUrl)) {
				return new URL(appUrl).origin;
			}
			return "http://localhost:3000";
		}),
	// Credentialed CORS for CORS_ORIGIN (cookies on cross-origin calls) and
	// trust in the CSRF guard / Better Auth trustedOrigins — off unless set:
	// script on that origin would otherwise act as the signed-in user.
	CORS_CREDENTIALS: strictFlag().default(false),
	POLAR_ACCESS_TOKEN: z.string().optional(),
	POLAR_SUCCESS_URL: z.url().optional(),
	GOOGLE_CLIENT_ID: z.string().optional(),
	GOOGLE_CLIENT_SECRET: z.string().optional(),
	GITHUB_CLIENT_ID: z.string().optional(),
	GITHUB_CLIENT_SECRET: z.string().optional(),
	GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
	// AI
	AI_PROVIDER: z
		.enum(["openrouter", "google", "openai", "anthropic", "noop"])
		.optional(),
	AI_API_KEY: z.string().optional(),
	AI_BASE_URL: z.url().optional(),
	AI_MODEL: z.string().optional(),
	// Cron
	CRON_PROVIDER: z.enum(["inline", "trigger-dev"]).optional(),
	// Bearer secret for the /api/cron trigger endpoint (Vercel Cron,
	// cron-job.org, etc. send `Authorization: Bearer <CRON_SECRET>`).
	// When unset the endpoint returns 501 — cron stays disabled.
	// min(16): the secret is compared verbatim as a Bearer token.
	CRON_SECRET: z.string().min(16).optional(),
	// Email
	EMAIL_PROVIDER: z
		.enum([
			"console",
			"noop",
			"resend",
			"plunk",
			"nodemailer",
			"postmark",
			"mailgun",
		])
		.optional(),
	EMAIL_FROM: z.string().optional(),
	RESEND_API_KEY: z.string().optional(),
	PLUNK_API_KEY: z.string().optional(),
	// Payments — Polar
	POLAR_WEBHOOK_SECRET: z.string().optional(),
	// Payments — Stripe
	STRIPE_SECRET_KEY: z.string().optional(),
	STRIPE_WEBHOOK_SECRET: z.string().optional(),
	// Payments — Creem
	CREEM_API_KEY: z.string().optional(),
	CREEM_WEBHOOK_SECRET: z.string().optional(),
	CREEM_TEST_MODE: z.stringbool().optional(),
	// Payments — Plan price/product IDs (provider-agnostic)
	// Set to your active provider's ID: Stripe price_id, Creem product_id, Polar product_id, etc.
	PAYMENTS_PRO_PRICE_ID: z.string().optional(),
	PAYMENTS_PRO_YEARLY_PRICE_ID: z.string().optional(),
	// Payments — Credit top-up package price IDs
	CREDITS_AI_TOKENS_100K_PRICE_ID: z.string().optional(),
	CREDITS_AI_TOKENS_500K_PRICE_ID: z.string().optional(),
	CREDITS_API_CALLS_50K_PRICE_ID: z.string().optional(),
	// Payments — Provider selection
	PAYMENTS_PROVIDER: z
		.enum(["polar", "stripe", "creem", "custom", "noop"])
		.optional(),
	// Storage (S3 / MinIO)
	STORAGE_PROVIDER: z.enum(["s3", "supabase", "noop"]).optional(),
	// Search (@fuutu/search)
	SEARCH_PROVIDER: z
		.enum(["postgres", "meilisearch", "typesense", "noop"])
		.optional(),
	S3_ENDPOINT: z.url().optional(),
	S3_REGION: z.string().optional(),
	S3_ACCESS_KEY_ID: z.string().optional(),
	S3_SECRET_ACCESS_KEY: z.string().optional(),
	S3_BUCKET_AVATARS: z.string().optional(),
	S3_BUCKET_ORGANIZATION_LOGOS: z.string().optional(),
	S3_BUCKET_DESKTOP_RELEASES: z.string().optional(),
	S3_FORCE_PATH_STYLE: z.stringbool().optional(),
	MINIO_ROOT_USER: z.string().optional(),
	MINIO_ROOT_PASSWORD: z.string().optional(),
	// Observability — consumed by the evlog drains selected via LOG_DRAIN
	SENTRY_DSN: z.url().optional(),
	AXIOM_TOKEN: z.string().optional(),
	AXIOM_DATASET: z.string().optional(),
	// Logging
	// Comma-separated drain list, e.g. "sentry,fs" — each entry must be a
	// known drain id (console is always on but allowed in the list).
	LOG_DRAIN: z
		.string()
		.refine(
			(v) =>
				v
					.split(",")
					.every((s) => LOG_DRAIN_VALUES.includes(s.trim().toLowerCase())),
			{
				message: `LOG_DRAIN must be a comma-separated list of: ${LOG_DRAIN_VALUES.join(", ")}`,
			},
		)
		.optional(),
	LOG_AUDIT_SINK: z.enum(["console", "db"]).default("console"),
	LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
	// Service label for log output — read directly by @fuutu/logs
	// (documented exception, see top of file); optional, default "fuutu".
	SERVICE_NAME: z.string().optional(),
	// Fuutu Business License & Telemetry
	FUUTU_LICENSE_KEY: z.string().optional(),
	FUUTU_LICENSE_ENDPOINT: z.url().optional(),
	FUUTU_TELEMETRY_ENDPOINT: z.url().optional(),
	FUUTU_TELEMETRY_DISABLED: z.stringbool().optional(),
	FUUTU_DISABLE_RATE_LIMIT: strictFlag().optional(),
	// Deploy start command (tooling/deploy/start-with-migrate.mjs) runs
	// `prisma migrate deploy` before the server; 0 skips it (migrations
	// run from CI). The script reads it before this schema loads.
	MIGRATE_ON_START: strictFlag().optional(),
	// Trust X-Forwarded-For / X-Real-IP for per-IP rate limiting — only
	// behind a reverse proxy that overwrites them (Traefik, nginx, LB).
	// Required in production (0 or 1): left unset, every client would
	// share one auth rate-limit bucket without anyone deciding so.
	TRUST_PROXY_HEADERS: strictFlag()
		.optional()
		.refine((v) => !isProduction() || v !== undefined, {
			message:
				"TRUST_PROXY_HEADERS must be set in production: 1 behind a reverse proxy that writes X-Forwarded-For, else 0",
		})
		.transform((v) => v ?? false),
	// With TRUST_PROXY_HEADERS=1: the header that carries the client IP set
	// by the edge in front of the proxy (e.g. CF-Connecting-IP behind
	// Cloudflare). Unset: the right-most X-Forwarded-For entry. Never a
	// header the client writes or a list (X-Forwarded-For, X-Real-IP, the
	// kit's own X-Fuutu-Client-IP).
	TRUSTED_CLIENT_IP_HEADER: z
		.string()
		.regex(/^[A-Za-z0-9-]{1,64}$/)
		.transform((v) => v.toLowerCase())
		.refine(
			(v) => !["x-forwarded-for", "x-real-ip", "x-fuutu-client-ip"].includes(v),
			{
				message:
					"TRUSTED_CLIENT_IP_HEADER must name the header your CDN sets with the client IP (e.g. CF-Connecting-IP), not X-Forwarded-For, X-Real-IP or X-Fuutu-Client-IP",
			},
		)
		.optional(),
	// Auth cookie prefix — set per project by the port slot (local dev),
	// so several projects on localhost don't share one login cookie.
	FUUTU_AUTH_COOKIE_PREFIX: z
		.string()
		.regex(/^[a-z0-9-]+$/)
		.optional(),
	// Explicit opt-in for outbound-webhook SSRF relaxation (http: +
	// private/loopback targets). Needed for local receivers in dev —
	// must NEVER be set in production.
	WEBHOOK_ALLOW_PRIVATE_URLS: strictFlag().optional(),
	// Seed scripts (`db:seed`): "1" lets them seed the compose database host
	// `postgres` (CI service container, a local compose rehearsal). Unset
	// everywhere else — inside a deployed stack that host is production.
	FUUTU_ALLOW_SEED: z.enum(["0", "1"]).optional(),
};

const kitClientEnv = {
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
};

// App vars (./app-env) join the kit groups; a key the kit already defines
// throws at load (mergeAppEnv). App server vars are read from process.env
// by key; client vars need literal reads and come mapped from the app file.
const appServerRuntimeEnv = Object.fromEntries(
	Object.keys(appServerEnv).map((key) => [key, process.env[key]]),
) as Record<keyof typeof appServerEnv, string | undefined>;

export const env = createEnv({
	server: mergeAppEnv(kitServerEnv, appServerEnv, "server"),
	shared: {
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
	},
	client: mergeAppEnv(kitClientEnv, appClientEnv, "client"),
	runtimeEnv: {
		...appServerRuntimeEnv,
		...appClientRuntimeEnv,
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
		DATABASE_URL: process.env.DATABASE_URL,
		REDIS_URL: process.env.REDIS_URL,
		BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
		BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
		CORS_ORIGIN: process.env.CORS_ORIGIN,
		CORS_CREDENTIALS: process.env.CORS_CREDENTIALS,
		POLAR_ACCESS_TOKEN: process.env.POLAR_ACCESS_TOKEN,
		POLAR_SUCCESS_URL: process.env.POLAR_SUCCESS_URL,
		GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
		GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
		GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
		GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
		GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
		AI_PROVIDER: process.env.AI_PROVIDER,
		AI_API_KEY: process.env.AI_API_KEY,
		AI_BASE_URL: process.env.AI_BASE_URL,
		AI_MODEL: process.env.AI_MODEL,
		CRON_PROVIDER: process.env.CRON_PROVIDER,
		CRON_SECRET: process.env.CRON_SECRET,
		NODE_ENV: process.env.NODE_ENV,
		EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
		EMAIL_FROM: process.env.EMAIL_FROM,
		RESEND_API_KEY: process.env.RESEND_API_KEY,
		PLUNK_API_KEY: process.env.PLUNK_API_KEY,
		POLAR_WEBHOOK_SECRET: process.env.POLAR_WEBHOOK_SECRET,
		STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
		STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
		CREEM_API_KEY: process.env.CREEM_API_KEY,
		CREEM_WEBHOOK_SECRET: process.env.CREEM_WEBHOOK_SECRET,
		CREEM_TEST_MODE: process.env.CREEM_TEST_MODE,
		PAYMENTS_PRO_PRICE_ID: process.env.PAYMENTS_PRO_PRICE_ID,
		PAYMENTS_PRO_YEARLY_PRICE_ID: process.env.PAYMENTS_PRO_YEARLY_PRICE_ID,
		CREDITS_AI_TOKENS_100K_PRICE_ID:
			process.env.CREDITS_AI_TOKENS_100K_PRICE_ID,
		CREDITS_AI_TOKENS_500K_PRICE_ID:
			process.env.CREDITS_AI_TOKENS_500K_PRICE_ID,
		CREDITS_API_CALLS_50K_PRICE_ID: process.env.CREDITS_API_CALLS_50K_PRICE_ID,
		PAYMENTS_PROVIDER: process.env.PAYMENTS_PROVIDER,
		STORAGE_PROVIDER: process.env.STORAGE_PROVIDER,
		SEARCH_PROVIDER: process.env.SEARCH_PROVIDER,
		S3_ENDPOINT: process.env.S3_ENDPOINT,
		S3_REGION: process.env.S3_REGION,
		S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
		S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
		S3_BUCKET_AVATARS: process.env.S3_BUCKET_AVATARS,
		S3_BUCKET_ORGANIZATION_LOGOS: process.env.S3_BUCKET_ORGANIZATION_LOGOS,
		S3_BUCKET_DESKTOP_RELEASES: process.env.S3_BUCKET_DESKTOP_RELEASES,
		S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE,
		MINIO_ROOT_USER: process.env.MINIO_ROOT_USER,
		MINIO_ROOT_PASSWORD: process.env.MINIO_ROOT_PASSWORD,
		SENTRY_DSN: process.env.SENTRY_DSN,
		AXIOM_TOKEN: process.env.AXIOM_TOKEN,
		AXIOM_DATASET: process.env.AXIOM_DATASET,
		LOG_DRAIN: process.env.LOG_DRAIN,
		LOG_AUDIT_SINK: process.env.LOG_AUDIT_SINK,
		LOG_LEVEL: process.env.LOG_LEVEL,
		SERVICE_NAME: process.env.SERVICE_NAME,
		FUUTU_LICENSE_KEY: process.env.FUUTU_LICENSE_KEY,
		FUUTU_LICENSE_ENDPOINT: process.env.FUUTU_LICENSE_ENDPOINT,
		FUUTU_TELEMETRY_ENDPOINT: process.env.FUUTU_TELEMETRY_ENDPOINT,
		FUUTU_TELEMETRY_DISABLED: process.env.FUUTU_TELEMETRY_DISABLED,
		FUUTU_DISABLE_RATE_LIMIT: process.env.FUUTU_DISABLE_RATE_LIMIT,
		MIGRATE_ON_START: process.env.MIGRATE_ON_START,
		TRUST_PROXY_HEADERS: process.env.TRUST_PROXY_HEADERS,
		TRUSTED_CLIENT_IP_HEADER: process.env.TRUSTED_CLIENT_IP_HEADER,
		FUUTU_AUTH_COOKIE_PREFIX: process.env.FUUTU_AUTH_COOKIE_PREFIX,
		WEBHOOK_ALLOW_PRIVATE_URLS: process.env.WEBHOOK_ALLOW_PRIVATE_URLS,
		FUUTU_ALLOW_SEED: process.env.FUUTU_ALLOW_SEED,
	},
	emptyStringAsUndefined: true,
	// Escape hatch for builds/CI that intentionally run without a full env
	// (e.g. bare `next build`). Set SKIP_ENV_VALIDATION=1 to skip.
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
