import { beforeEach, describe, expect, it, vi } from "vitest";

// App-owned env shapes (`../app-env`) are merged into every env surface:
// server vars into @fuutu/env/saas only, client vars into all of them.
vi.mock("../app-env", async () => {
	const { z } = await import("zod");
	return {
		appServerEnv: { APP_PARTNER_TOKEN: z.string().min(8) },
		appClientEnv: { NEXT_PUBLIC_APP_REGION: z.enum(["eu", "us"]).optional() },
		appClientRuntimeEnv: {
			get NEXT_PUBLIC_APP_REGION() {
				return process.env.NEXT_PUBLIC_APP_REGION;
			},
		},
	};
});

/** The mocked app keys are not in the real (empty) app types. */
async function importSaasEnv(): Promise<Record<string, unknown>> {
	return (await import("../saas")).env;
}

function setRequiredSaasEnv() {
	process.env.DATABASE_URL = "postgresql://localhost:5432/test";
	process.env.BETTER_AUTH_SECRET = "a".repeat(32);
	process.env.BETTER_AUTH_URL = "http://localhost:3000";
}

const originalEnv = process.env;

beforeEach(() => {
	vi.resetModules();
	process.env = { ...originalEnv };
	delete process.env.SKIP_ENV_VALIDATION;
	delete process.env.APP_PARTNER_TOKEN;
	delete process.env.NEXT_PUBLIC_APP_REGION;
});

describe("app env in @fuutu/env/saas", () => {
	it("exposes a valid app server var", async () => {
		setRequiredSaasEnv();
		process.env.APP_PARTNER_TOKEN = "partner-123";

		const env = await importSaasEnv();
		expect(env.APP_PARTNER_TOKEN).toBe("partner-123");
	});

	it("rejects a missing required app server var", async () => {
		setRequiredSaasEnv();

		await expect(import("../saas")).rejects.toThrow();
	});

	it("rejects an invalid app server var", async () => {
		setRequiredSaasEnv();
		process.env.APP_PARTNER_TOKEN = "short";

		await expect(import("../saas")).rejects.toThrow();
	});

	it("exposes and validates an app client var", async () => {
		setRequiredSaasEnv();
		process.env.APP_PARTNER_TOKEN = "partner-123";
		process.env.NEXT_PUBLIC_APP_REGION = "eu";

		const env = await importSaasEnv();
		expect(env.NEXT_PUBLIC_APP_REGION).toBe("eu");

		vi.resetModules();
		process.env.NEXT_PUBLIC_APP_REGION = "mars";
		await expect(import("../saas")).rejects.toThrow();
	});
});

describe("app env in the public surfaces", () => {
	it("exposes app client vars but never app server vars", async () => {
		process.env.APP_PARTNER_TOKEN = "partner-123";
		process.env.NEXT_PUBLIC_APP_REGION = "us";

		for (const surface of ["../marketing", "../docs", "../public"]) {
			vi.resetModules();
			const { env } = await import(surface);
			expect(env.NEXT_PUBLIC_APP_REGION, surface).toBe("us");
			expect("APP_PARTNER_TOKEN" in env, surface).toBe(false);
		}
	});
});
