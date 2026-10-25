import { beforeEach, describe, expect, it, vi } from "vitest";

function setRequiredSaasEnv() {
	process.env.DATABASE_URL = "postgresql://localhost:5432/test";
	process.env.BETTER_AUTH_SECRET = "a".repeat(32);
	process.env.BETTER_AUTH_URL = "http://localhost:3000";
}

describe("@fuutu/env/saas", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		vi.resetModules();
		process.env = { ...originalEnv };
		delete process.env.SKIP_ENV_VALIDATION;
	});

	it("validates required env vars successfully", async () => {
		setRequiredSaasEnv();
		process.env.NODE_ENV = "development";

		const { env } = await import("../saas");
		expect(env.DATABASE_URL).toBe("postgresql://localhost:5432/test");
	});

	it("rejects when a required env var is missing", async () => {
		process.env.DATABASE_URL = "postgresql://localhost:5432/test";
		process.env.BETTER_AUTH_URL = "http://localhost:3000";
		delete process.env.BETTER_AUTH_SECRET;

		await expect(import("../saas")).rejects.toThrow();
	});

	it("rejects an invalid required env var", async () => {
		setRequiredSaasEnv();
		process.env.BETTER_AUTH_URL = "not-a-url";

		await expect(import("../saas")).rejects.toThrow();
	});

	it("defaults NODE_ENV to development", async () => {
		setRequiredSaasEnv();
		delete process.env.NODE_ENV;

		const { env } = await import("../saas");
		expect(env.NODE_ENV).toBe("development");
	});

	it("accepts valid NODE_ENV values", async () => {
		const validEnvs = ["development", "production", "test"] as const;
		for (const nodeEnv of validEnvs) {
			vi.resetModules();
			setRequiredSaasEnv();
			process.env.NODE_ENV = nodeEnv;
			const { env } = await import("../saas");
			expect(env.NODE_ENV).toBe(nodeEnv);
		}
	});

	it("defaults CORS_ORIGIN to localhost:3000", async () => {
		setRequiredSaasEnv();
		delete process.env.CORS_ORIGIN;

		const { env } = await import("../saas");
		expect(env.CORS_ORIGIN).toBe("http://localhost:3000");
	});

	it("rejects CORS_ORIGIN='*'", async () => {
		setRequiredSaasEnv();
		process.env.CORS_ORIGIN = "*";

		await expect(import("../saas")).rejects.toThrow();
	});

	it("accepts valid AI_PROVIDER enum values", async () => {
		const validProviders = ["google", "openai", "anthropic", "noop"] as const;
		for (const provider of validProviders) {
			vi.resetModules();
			setRequiredSaasEnv();
			process.env.AI_PROVIDER = provider;
			const { env } = await import("../saas");
			expect(env.AI_PROVIDER).toBe(provider);
		}
	});

	it("accepts valid EMAIL_PROVIDER enum values", async () => {
		const validProviders = [
			"console",
			"noop",
			"resend",
			"plunk",
			"nodemailer",
			"postmark",
			"mailgun",
		] as const;
		for (const provider of validProviders) {
			vi.resetModules();
			setRequiredSaasEnv();
			process.env.EMAIL_PROVIDER = provider;
			const { env } = await import("../saas");
			expect(env.EMAIL_PROVIDER).toBe(provider);
		}
	});

	it("accepts a comma-separated LOG_DRAIN list", async () => {
		setRequiredSaasEnv();
		process.env.LOG_DRAIN = "sentry,fs";

		const { env } = await import("../saas");
		expect(env.LOG_DRAIN).toBe("sentry,fs");
	});

	it("accepts a single LOG_DRAIN value", async () => {
		setRequiredSaasEnv();
		process.env.LOG_DRAIN = "memory";

		const { env } = await import("../saas");
		expect(env.LOG_DRAIN).toBe("memory");
	});

	it("rejects unknown LOG_DRAIN entries", async () => {
		setRequiredSaasEnv();
		process.env.LOG_DRAIN = "sentry,bogus";

		await expect(import("../saas")).rejects.toThrow();
	});

	it("enforces the 32-char BETTER_AUTH_SECRET boundary", async () => {
		process.env.DATABASE_URL = "postgresql://localhost:5432/test";
		process.env.BETTER_AUTH_SECRET = "a".repeat(31);
		process.env.BETTER_AUTH_URL = "http://localhost:3000";

		await expect(import("../saas")).rejects.toThrow();

		vi.resetModules();
		setRequiredSaasEnv();

		const { env } = await import("../saas");
		expect(env.BETTER_AUTH_SECRET).toBe("a".repeat(32));
	});

	it("rejects a CRON_SECRET shorter than 16 chars", async () => {
		setRequiredSaasEnv();
		process.env.CRON_SECRET = "too-short";

		await expect(import("../saas")).rejects.toThrow();
	});

	it("accepts a CRON_SECRET of 16+ chars", async () => {
		setRequiredSaasEnv();
		process.env.CRON_SECRET = "s".repeat(16);

		const { env } = await import("../saas");
		expect(env.CRON_SECRET).toBe("s".repeat(16));
	});

	it("transforms WEBHOOK_ALLOW_PRIVATE_URLS string to boolean", async () => {
		setRequiredSaasEnv();
		process.env.WEBHOOK_ALLOW_PRIVATE_URLS = "1";

		let mod = await import("../saas");
		expect(mod.env.WEBHOOK_ALLOW_PRIVATE_URLS).toBe(true);

		vi.resetModules();
		setRequiredSaasEnv();
		delete process.env.WEBHOOK_ALLOW_PRIVATE_URLS;

		mod = await import("../saas");
		expect(mod.env.WEBHOOK_ALLOW_PRIVATE_URLS).toBeUndefined();
	});

	it("transforms FUUTU_TELEMETRY_DISABLED string to boolean", async () => {
		setRequiredSaasEnv();
		process.env.FUUTU_TELEMETRY_DISABLED = "1";

		let mod = await import("../saas");
		expect(mod.env.FUUTU_TELEMETRY_DISABLED).toBe(true);

		vi.resetModules();
		setRequiredSaasEnv();
		process.env.FUUTU_TELEMETRY_DISABLED = "0";

		mod = await import("../saas");
		expect(mod.env.FUUTU_TELEMETRY_DISABLED).toBe(false);
	});

	it("accepts case-insensitive FUUTU_TELEMETRY_DISABLED values", async () => {
		setRequiredSaasEnv();
		process.env.FUUTU_TELEMETRY_DISABLED = "TRUE";

		const { env } = await import("../saas");
		expect(env.FUUTU_TELEMETRY_DISABLED).toBe(true);
	});

	it("transforms S3_FORCE_PATH_STYLE string to boolean", async () => {
		setRequiredSaasEnv();
		process.env.S3_FORCE_PATH_STYLE = "true";

		let mod = await import("../saas");
		expect(mod.env.S3_FORCE_PATH_STYLE).toBe(true);

		vi.resetModules();
		setRequiredSaasEnv();
		process.env.S3_FORCE_PATH_STYLE = "false";

		mod = await import("../saas");
		expect(mod.env.S3_FORCE_PATH_STYLE).toBe(false);
	});

	it("skips validation when SKIP_ENV_VALIDATION is set", async () => {
		delete process.env.DATABASE_URL;
		delete process.env.BETTER_AUTH_SECRET;
		delete process.env.BETTER_AUTH_URL;
		process.env.SKIP_ENV_VALIDATION = "1";

		const { env } = await import("../saas");
		expect(env).toBeDefined();
	});
});

describe("@fuutu/env/marketing", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		vi.resetModules();
		process.env = { ...originalEnv };
	});

	it("validates with no required server env vars", async () => {
		const { env } = await import("../marketing");
		expect(env).toBeDefined();
	});

	it("accepts valid NEXT_PUBLIC_* URLs", async () => {
		process.env.NEXT_PUBLIC_MARKETING_URL = "https://example.com";
		process.env.NEXT_PUBLIC_SAAS_URL = "https://app.example.com";
		process.env.NEXT_PUBLIC_DOCS_URL = "https://docs.example.com";

		const { env } = await import("../marketing");
		expect(env.NEXT_PUBLIC_MARKETING_URL).toBe("https://example.com");
	});

	it("rejects an invalid NEXT_PUBLIC_* URL", async () => {
		process.env.NEXT_PUBLIC_MARKETING_URL = "not-a-url";

		await expect(import("../marketing")).rejects.toThrow();
	});

	it("accepts valid analytics provider enum values", async () => {
		const validProviders = [
			"umami",
			"plausible",
			"pirsch",
			"mixpanel",
			"ga4",
			"noop",
		] as const;
		for (const provider of validProviders) {
			vi.resetModules();
			process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER = provider;
			const { env } = await import("../marketing");
			expect(env.NEXT_PUBLIC_ANALYTICS_PROVIDER).toBe(provider);
		}
	});

	it("accepts bare and leading-dot consent cookie domains", async () => {
		for (const domain of ["example.com", ".example.com", "app.example.com"]) {
			vi.resetModules();
			process.env.NEXT_PUBLIC_ANALYTICS_CONSENT_DOMAIN = domain;
			const { env } = await import("../marketing");
			expect(env.NEXT_PUBLIC_ANALYTICS_CONSENT_DOMAIN).toBe(domain);
		}
	});

	it("rejects an invalid consent cookie domain", async () => {
		for (const domain of [
			"http://example.com",
			"example.com/path",
			"-bad.com",
			"bad-.com",
			"..example.com",
			"exa mple.com",
		]) {
			vi.resetModules();
			process.env.NEXT_PUBLIC_ANALYTICS_CONSENT_DOMAIN = domain;
			await expect(import("../marketing")).rejects.toThrow();
		}
	});

	it("treats an empty consent cookie domain as unset", async () => {
		process.env.NEXT_PUBLIC_ANALYTICS_CONSENT_DOMAIN = "";

		const { env } = await import("../marketing");
		expect(env.NEXT_PUBLIC_ANALYTICS_CONSENT_DOMAIN).toBeUndefined();
	});

	it("allows all client vars to be optional", async () => {
		delete process.env.NEXT_PUBLIC_MARKETING_URL;
		delete process.env.NEXT_PUBLIC_SAAS_URL;
		delete process.env.NEXT_PUBLIC_DOCS_URL;
		delete process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER;
		delete process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
		delete process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL;

		const { env } = await import("../marketing");
		expect(env.NEXT_PUBLIC_ANALYTICS_PROVIDER).toBeUndefined();
	});
});

describe("@fuutu/env/docs", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		vi.resetModules();
		process.env = { ...originalEnv };
	});

	it("validates with no required server env vars", async () => {
		const { env } = await import("../docs");
		expect(env).toBeDefined();
		expect("DATABASE_URL" in env).toBe(false);
	});

	it("roundtrips NEXT_PUBLIC_DOCS_URL", async () => {
		process.env.NEXT_PUBLIC_DOCS_URL = "https://docs.example.com";

		const { env } = await import("../docs");
		expect(env.NEXT_PUBLIC_DOCS_URL).toBe("https://docs.example.com");
	});
});
