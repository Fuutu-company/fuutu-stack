import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@fuutu/ai", () => ({ resolveAIProvider: vi.fn() }));

vi.mock("@fuutu/auth", () => ({
	auth: { api: { getSession: vi.fn(), getFullOrganization: vi.fn() } },
}));

vi.mock("@fuutu/db", () => ({
	getUserAccessState: vi.fn(),
	pingDatabase: vi.fn(),
	getCronJobRun: vi.fn(),
}));

vi.mock("@fuutu/cron", () => ({
	allJobs: [
		{ name: "webhook-retry", schedule: "*/5 * * * *", enabled: true },
		{ name: "app-report", schedule: "0 3 * * *", enabled: false },
	],
}));

// Environment the status page reads — secrets must never leave it.
const envOverrides = vi.hoisted(() => ({
	values: {} as Record<string, unknown>,
}));
vi.mock("@fuutu/env/saas", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@fuutu/env/saas")>();
	return {
		...actual,
		env: new Proxy(actual.env, {
			get: (target, prop) =>
				typeof prop === "string" && prop in envOverrides.values
					? envOverrides.values[prop]
					: Reflect.get(target, prop),
		}),
	};
});

const rateLimit = vi.hoisted(() => ({ keys: [] as string[] }));
vi.mock("@fuutu/utils/rate-limit", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@fuutu/utils/rate-limit")>();
	return {
		...actual,
		defaultRateLimitStore: {
			async check(key: string, limit: { windowMs: number }) {
				rateLimit.keys.push(key);
				return {
					allowed: true,
					remaining: 1,
					resetAt: Date.now() + limit.windowMs,
				};
			},
		},
	};
});

const db = await import("@fuutu/db");
const { adminRouter } = await import("../modules/admin/router");

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ADMIN_ID = "admin-1";
const RUN_AT = new Date("2026-06-01T12:00:00Z");
const admin = makeUser({ id: ADMIN_ID, role: "admin" });

const adminContext = () => makeSession<Context>(admin);

function impersonatedContext(): Context {
	const ctx = makeSession<Context>(admin);
	(ctx.session?.session as { impersonatedBy?: string }).impersonatedBy =
		"admin-9";
	return ctx;
}

const apiKeyContext = () =>
	({
		session: { user: admin },
		headers: new Headers(),
		apiKey: { id: "key-1", organizationId: null },
	}) as unknown as Context;

const status = (context: Context = adminContext()) =>
	call(adminRouter.system.status, undefined as never, { context });

beforeEach(() => {
	vi.clearAllMocks();
	rateLimit.keys = [];
	envOverrides.values = {};
	vi.mocked(db.getUserAccessState).mockImplementation(((id: string) =>
		Promise.resolve(
			id === ADMIN_ID
				? {
						id,
						email: "admin@fuutu.local",
						role: "admin",
						banned: false,
						banExpires: null,
					}
				: null,
		)) as never);
	vi.mocked(db.pingDatabase).mockResolvedValue({ ok: true, latencyMs: 4 });
	vi.mocked(db.getCronJobRun).mockImplementation(((key: string) =>
		Promise.resolve(
			key === "webhook-retry"
				? {
						id: "run-1",
						jobKey: key,
						lastRunAt: RUN_AT,
						lastStatus: "error",
						lastError: "ECONNREFUSED db.internal:5432 password=hunter2",
					}
				: null,
		)) as never);
});

// ─── Access matrix ──────────────────────────────────────────────────────────

describe("admin.system.status access", () => {
	it("rejects unauthenticated callers with 401", async () => {
		await expect(status(makeSession<Context>(null))).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("rejects a system role user with 403", async () => {
		await expect(
			status(makeSession<Context>(makeUser({ id: "user-2" }))),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("rejects an admin's API key with 403", async () => {
		await expect(status(apiKeyContext())).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
	});

	it("rejects an impersonation session with 403", async () => {
		await expect(status(impersonatedContext())).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
	});

	it("serves a system admin and draws from the adminRead budget", async () => {
		await expect(status()).resolves.toBeDefined();
		expect(rateLimit.keys).toContain(`adminRead:${ADMIN_ID}`);
	});
});

// ─── Payload ────────────────────────────────────────────────────────────────

describe("admin.system.status payload", () => {
	it("reports the database ping", async () => {
		expect((await status()).database).toEqual({ ok: true, latencyMs: 4 });
		vi.mocked(db.pingDatabase).mockResolvedValue({ ok: false, latencyMs: 9 });
		expect((await status()).database).toEqual({ ok: false, latencyMs: 9 });
	});

	it("lists a provider per swappable domain, configured only with its credentials", async () => {
		envOverrides.values = {
			EMAIL_PROVIDER: "resend",
			RESEND_API_KEY: "re_SECRET_KEY",
			STORAGE_PROVIDER: "s3",
			S3_ACCESS_KEY_ID: "AKIA_SECRET",
			S3_SECRET_ACCESS_KEY: undefined,
			AI_PROVIDER: "openrouter",
			AI_API_KEY: "sk-or-SECRET",
			NEXT_PUBLIC_ANALYTICS_PROVIDER: "umami",
			NEXT_PUBLIC_UMAMI_WEBSITE_ID: undefined,
		};
		const { providers } = await status();
		const byDomain = Object.fromEntries(
			providers.map((p) => [p.domain, p] as const),
		);
		expect(Object.keys(byDomain).sort()).toEqual([
			"ai",
			"analytics",
			"logs",
			"mail",
			"payments",
			"storage",
		]);
		expect(byDomain.mail).toEqual({
			domain: "mail",
			provider: "resend",
			configured: true,
		});
		// S3 without the secret key is not usable.
		expect(byDomain.storage).toEqual({
			domain: "storage",
			provider: "s3",
			configured: false,
		});
		expect(byDomain.ai).toMatchObject({
			provider: "openrouter",
			configured: true,
		});
		expect(byDomain.analytics).toMatchObject({
			provider: "umami",
			configured: false,
		});
	});

	it("treats the console and noop providers as not configured", async () => {
		envOverrides.values = { EMAIL_PROVIDER: "console", AI_PROVIDER: "noop" };
		const { providers } = await status();
		expect(providers.find((p) => p.domain === "mail")).toMatchObject({
			provider: "console",
			configured: false,
		});
		expect(providers.find((p) => p.domain === "ai")).toMatchObject({
			provider: "noop",
			configured: false,
		});
	});

	it("never returns a secret value", async () => {
		envOverrides.values = {
			EMAIL_PROVIDER: "resend",
			RESEND_API_KEY: "re_SECRET_KEY",
			AI_API_KEY: "sk-or-SECRET",
			S3_ACCESS_KEY_ID: "AKIA_SECRET",
			S3_SECRET_ACCESS_KEY: "s3_SECRET",
			CREEM_API_KEY: "creem_SECRET",
			CREEM_WEBHOOK_SECRET: "whsec_SECRET",
			SENTRY_DSN: "https://key@sentry.example/1",
		};
		const serialized = JSON.stringify(await status());
		expect(serialized).not.toMatch(/SECRET/);
		expect(serialized).not.toContain("sentry.example");
	});

	it("merges the job registry with the last recorded runs, without error text", async () => {
		const { cron } = await status();
		expect(cron).toEqual([
			{
				key: "webhook-retry",
				schedule: "*/5 * * * *",
				enabled: true,
				lastRunAt: RUN_AT,
				lastStatus: "error",
			},
			{
				key: "app-report",
				schedule: "0 3 * * *",
				enabled: false,
				lastRunAt: null,
				lastStatus: null,
			},
		]);
		expect(JSON.stringify(cron)).not.toContain("hunter2");
	});

	it("lists feature flags as booleans and strings only", async () => {
		const { features } = await status();
		expect(features.length).toBeGreaterThan(3);
		for (const feature of features) {
			expect(["boolean", "string"]).toContain(typeof feature.value);
		}
		expect(features.map((f) => f.key)).toContain("organizationsMode");
	});

	it("reports the app and kit version", async () => {
		const { versions } = await status();
		expect(versions.app).toMatch(/^\d+\.\d+\.\d+/);
		expect(versions.kit).toMatch(/^\d+\.\d+\.\d+/);
	});
});
