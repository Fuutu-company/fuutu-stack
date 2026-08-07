import { beforeEach, describe, expect, it, vi } from "vitest";

describe("@fuutu/env/saas", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		vi.resetModules();
		process.env = { ...originalEnv };
	});

	it("validates required env vars successfully", () => {
		process.env.DATABASE_URL = "postgresql://localhost:5432/test";
		process.env.BETTER_AUTH_SECRET = "a".repeat(32);
		process.env.BETTER_AUTH_URL = "http://localhost:3000";
		process.env.NODE_ENV = "development";

		expect(() => {
			vi.importActual("../saas");
		}).not.toThrow();
	});

	it("defaults NODE_ENV to development", () => {
		process.env.DATABASE_URL = "postgresql://localhost:5432/test";
		process.env.BETTER_AUTH_SECRET = "a".repeat(32);
		process.env.BETTER_AUTH_URL = "http://localhost:3000";
		delete process.env.NODE_ENV;

		expect(() => {
			vi.importActual("../saas");
		}).not.toThrow();
	});

	it("accepts valid NODE_ENV values", () => {
		process.env.DATABASE_URL = "postgresql://localhost:5432/test";
		process.env.BETTER_AUTH_SECRET = "a".repeat(32);
		process.env.BETTER_AUTH_URL = "http://localhost:3000";

		const validEnvs = ["development", "production", "test"] as const;
		for (const nodeEnv of validEnvs) {
			process.env.NODE_ENV = nodeEnv;
			vi.resetModules();
			expect(() => {
				vi.importActual("../saas");
			}).not.toThrow();
		}
	});

	it("defaults CORS_ORIGIN to localhost:3000", () => {
		process.env.DATABASE_URL = "postgresql://localhost:5432/test";
		process.env.BETTER_AUTH_SECRET = "a".repeat(32);
		process.env.BETTER_AUTH_URL = "http://localhost:3000";
		delete process.env.CORS_ORIGIN;

		expect(() => {
			vi.importActual("../saas");
		}).not.toThrow();
	});

	it("accepts valid AI_PROVIDER enum values", () => {
		process.env.DATABASE_URL = "postgresql://localhost:5432/test";
		process.env.BETTER_AUTH_SECRET = "a".repeat(32);
		process.env.BETTER_AUTH_URL = "http://localhost:3000";

		const validProviders = ["google", "openai", "anthropic", "noop"] as const;
		for (const provider of validProviders) {
			process.env.AI_PROVIDER = provider;
			vi.resetModules();
			expect(() => {
				vi.importActual("../saas");
			}).not.toThrow();
		}
	});

	it("accepts valid EMAIL_PROVIDER enum values", () => {
		process.env.DATABASE_URL = "postgresql://localhost:5432/test";
		process.env.BETTER_AUTH_SECRET = "a".repeat(32);
		process.env.BETTER_AUTH_URL = "http://localhost:3000";

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
			process.env.EMAIL_PROVIDER = provider;
			vi.resetModules();
			expect(() => {
				vi.importActual("../saas");
			}).not.toThrow();
		}
	});

	it("transforms FUUTU_TELEMETRY_DISABLED string to boolean", () => {
		process.env.DATABASE_URL = "postgresql://localhost:5432/test";
		process.env.BETTER_AUTH_SECRET = "a".repeat(32);
		process.env.BETTER_AUTH_URL = "http://localhost:3000";
		process.env.FUUTU_TELEMETRY_DISABLED = "1";

		expect(() => {
			vi.importActual("../saas");
		}).not.toThrow();

		vi.resetModules();
		process.env.DATABASE_URL = "postgresql://localhost:5432/test";
		process.env.BETTER_AUTH_SECRET = "a".repeat(32);
		process.env.BETTER_AUTH_URL = "http://localhost:3000";
		process.env.FUUTU_TELEMETRY_DISABLED = "0";

		expect(() => {
			vi.importActual("../saas");
		}).not.toThrow();
	});

	it("transforms S3_FORCE_PATH_STYLE string to boolean", () => {
		process.env.DATABASE_URL = "postgresql://localhost:5432/test";
		process.env.BETTER_AUTH_SECRET = "a".repeat(32);
		process.env.BETTER_AUTH_URL = "http://localhost:3000";
		process.env.S3_FORCE_PATH_STYLE = "true";

		expect(() => {
			vi.importActual("../saas");
		}).not.toThrow();

		vi.resetModules();
		process.env.DATABASE_URL = "postgresql://localhost:5432/test";
		process.env.BETTER_AUTH_SECRET = "a".repeat(32);
		process.env.BETTER_AUTH_URL = "http://localhost:3000";
		process.env.S3_FORCE_PATH_STYLE = "false";

		expect(() => {
			vi.importActual("../saas");
		}).not.toThrow();
	});
});

describe("@fuutu/env/marketing", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		vi.resetModules();
		process.env = { ...originalEnv };
	});

	it("validates with no required server env vars", () => {
		expect(() => {
			vi.importActual("../marketing");
		}).not.toThrow();
	});

	it("accepts valid NEXT_PUBLIC_* URLs", () => {
		process.env.NEXT_PUBLIC_MARKETING_URL = "https://example.com";
		process.env.NEXT_PUBLIC_SAAS_URL = "https://app.example.com";
		process.env.NEXT_PUBLIC_DOCS_URL = "https://docs.example.com";

		expect(() => {
			vi.importActual("../marketing");
		}).not.toThrow();
	});

	it("accepts valid analytics provider enum values", () => {
		const validProviders = [
			"umami",
			"plausible",
			"pirsch",
			"mixpanel",
			"ga4",
			"noop",
		] as const;
		for (const provider of validProviders) {
			process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER = provider;
			vi.resetModules();
			expect(() => {
				vi.importActual("../marketing");
			}).not.toThrow();
		}
	});

	it("allows all client vars to be optional", () => {
		delete process.env.NEXT_PUBLIC_MARKETING_URL;
		delete process.env.NEXT_PUBLIC_SAAS_URL;
		delete process.env.NEXT_PUBLIC_DOCS_URL;
		delete process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER;
		delete process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
		delete process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL;

		expect(() => {
			vi.importActual("../marketing");
		}).not.toThrow();
	});
});
