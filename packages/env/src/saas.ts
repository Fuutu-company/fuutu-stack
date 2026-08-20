import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	server: {
		DATABASE_URL: z.string().min(1),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.string().url(),
		CORS_ORIGIN: z.string().optional().default("http://localhost:3000"),
		POLAR_ACCESS_TOKEN: z.string().optional(),
		POLAR_PRODUCT_ID: z.string().optional(),
		POLAR_SUCCESS_URL: z.string().optional(),
		GOOGLE_CLIENT_ID: z.string().optional(),
		GOOGLE_CLIENT_SECRET: z.string().optional(),
		GITHUB_CLIENT_ID: z.string().optional(),
		GITHUB_CLIENT_SECRET: z.string().optional(),
		GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
		// AI
		AI_PROVIDER: z.enum(["google", "openai", "anthropic", "noop"]).optional(),
		AI_API_KEY: z.string().optional(),
		AI_MODEL: z.string().optional(),
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
		CREEM_TEST_MODE: z
			.enum(["true", "false"])
			.optional()
			.transform((v) => v === "true"),
		// Payments — Plan price/product IDs (provider-agnostic)
		// Set to your active provider's ID: Stripe price_id, Creem product_id, Polar product_id, etc.
		PAYMENTS_PRO_PRICE_ID: z.string().optional(),
		PAYMENTS_PRO_YEARLY_PRICE_ID: z.string().optional(),
		// Payments — Credit top-up package price IDs
		CREDITS_AI_TOKENS_100K_PRICE_ID: z.string().optional(),
		CREDITS_AI_TOKENS_500K_PRICE_ID: z.string().optional(),
		CREDITS_API_CALLS_50K_PRICE_ID: z.string().optional(),
		// Payments — Provider selection
		PAYMENTS_PROVIDER: z.enum(["polar", "stripe", "creem"]).optional(),
		// Storage (S3 / MinIO)
		STORAGE_PROVIDER: z.enum(["s3", "supabase", "noop"]).optional(),
		S3_ENDPOINT: z.string().optional(),
		S3_REGION: z.string().optional(),
		S3_ACCESS_KEY_ID: z.string().optional(),
		S3_SECRET_ACCESS_KEY: z.string().optional(),
		S3_BUCKET_AVATARS: z.string().optional(),
		S3_BUCKET_ORGANIZATION_LOGOS: z.string().optional(),
		S3_FORCE_PATH_STYLE: z
			.enum(["true", "false"])
			.optional()
			.transform((v) => v === "true"),
		MINIO_ROOT_USER: z.string().optional(),
		MINIO_ROOT_PASSWORD: z.string().optional(),
		// Observability
		AXIOM_TOKEN: z.string().optional(),
		AXIOM_DATASET: z.string().optional(),
		// Logging
		LOG_PROVIDER: z
			.enum(["evlog", "console", "pino", "axiom", "noop"])
			.default("evlog"),
		LOG_AUDIT_SINK: z
			.enum(["console", "db", "axiom", "noop"])
			.default("console"),
		LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
		// Fuutu Business License & Telemetry
		FUUTU_LICENSE_KEY: z.string().optional(),
		FUUTU_LICENSE_ENDPOINT: z.string().url().optional(),
		FUUTU_TELEMETRY_ENDPOINT: z.string().url().optional(),
		FUUTU_TELEMETRY_DISABLED: z
			.enum(["0", "1", "true", "false"])
			.optional()
			.transform((v) => v === "1" || v === "true"),
		FUUTU_DISABLE_RATE_LIMIT: z
			.enum(["0", "1", "true", "false"])
			.optional()
			.transform((v) => v === "1" || v === "true"),
	},
	shared: {
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
	},
	client: {
		NEXT_PUBLIC_MARKETING_URL: z.string().url().optional(),
		NEXT_PUBLIC_SAAS_URL: z.string().url().optional(),
		NEXT_PUBLIC_ANALYTICS_PROVIDER: z
			.enum(["umami", "plausible", "pirsch", "mixpanel", "ga4", "noop"])
			.optional(),
		NEXT_PUBLIC_UMAMI_WEBSITE_ID: z.string().optional(),
		NEXT_PUBLIC_UMAMI_SCRIPT_URL: z.string().url().optional(),
	},
	runtimeEnv: {
		NEXT_PUBLIC_MARKETING_URL: process.env.NEXT_PUBLIC_MARKETING_URL,
		NEXT_PUBLIC_SAAS_URL: process.env.NEXT_PUBLIC_SAAS_URL,
		NEXT_PUBLIC_ANALYTICS_PROVIDER: process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER,
		NEXT_PUBLIC_UMAMI_WEBSITE_ID: process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID,
		NEXT_PUBLIC_UMAMI_SCRIPT_URL: process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL,
		DATABASE_URL: process.env.DATABASE_URL,
		BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
		BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
		CORS_ORIGIN: process.env.CORS_ORIGIN,
		POLAR_ACCESS_TOKEN: process.env.POLAR_ACCESS_TOKEN,
		POLAR_PRODUCT_ID: process.env.POLAR_PRODUCT_ID,
		POLAR_SUCCESS_URL: process.env.POLAR_SUCCESS_URL,
		GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
		GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
		GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
		GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
		GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
		AI_PROVIDER: process.env.AI_PROVIDER,
		AI_API_KEY: process.env.AI_API_KEY,
		AI_MODEL: process.env.AI_MODEL,
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
		S3_ENDPOINT: process.env.S3_ENDPOINT,
		S3_REGION: process.env.S3_REGION,
		S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
		S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
		S3_BUCKET_AVATARS: process.env.S3_BUCKET_AVATARS,
		S3_BUCKET_ORGANIZATION_LOGOS: process.env.S3_BUCKET_ORGANIZATION_LOGOS,
		S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE,
		MINIO_ROOT_USER: process.env.MINIO_ROOT_USER,
		MINIO_ROOT_PASSWORD: process.env.MINIO_ROOT_PASSWORD,
		AXIOM_TOKEN: process.env.AXIOM_TOKEN,
		AXIOM_DATASET: process.env.AXIOM_DATASET,
		LOG_PROVIDER: process.env.LOG_PROVIDER,
		LOG_AUDIT_SINK: process.env.LOG_AUDIT_SINK,
		LOG_LEVEL: process.env.LOG_LEVEL,
		FUUTU_LICENSE_KEY: process.env.FUUTU_LICENSE_KEY,
		FUUTU_LICENSE_ENDPOINT: process.env.FUUTU_LICENSE_ENDPOINT,
		FUUTU_TELEMETRY_ENDPOINT: process.env.FUUTU_TELEMETRY_ENDPOINT,
		FUUTU_TELEMETRY_DISABLED: process.env.FUUTU_TELEMETRY_DISABLED,
		FUUTU_DISABLE_RATE_LIMIT: process.env.FUUTU_DISABLE_RATE_LIMIT,
	},
	emptyStringAsUndefined: true,
});
