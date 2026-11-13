import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `throttlePreAuth` counts FAILED credential checks per trusted client IP.
 * Valid credentials never consume the budget; once an IP is over it, every
 * credentialed request from it gets 429 until the window resets. Without a
 * trusted client IP there is no throttling at all — one shared bucket would
 * let an anonymous attacker lock out every real client.
 */

const config = vi.hoisted(() => ({
	apiConfig: {
		rateLimit: {
			enabled: true,
			trustProxyHeaders: true,
			preAuth: { maxRequests: 2, windowMs: 60_000 },
		},
	},
}));
vi.mock("../config", () => config);

const envState = vi.hoisted(() => ({ NODE_ENV: "test" }));
vi.mock("@fuutu/env/saas", () => ({ env: envState }));

const warn = vi.hoisted(() => vi.fn());
vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({ info: vi.fn(), warn, error: vi.fn(), debug: vi.fn() }),
}));

// A fresh store per test instead of the process-wide singleton.
const store = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@fuutu/utils/rate-limit", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@fuutu/utils/rate-limit")>();
	return {
		...actual,
		get defaultRateLimitStore() {
			return store.current;
		},
	};
});

const { createMemoryRateLimitStore } = await import("@fuutu/utils/rate-limit");
const { throttlePreAuth } = await import("../pre-auth-throttle");

const WARNED = Symbol.for("fuutu.api.preAuthUntrustedWarned");
const headers = new Headers({ "x-forwarded-for": "203.0.113.7" });
const reject = () => Promise.resolve(null);
const accept = () => Promise.resolve({ orgId: "org-1" });

async function fail(key: string, times: number) {
	for (let i = 0; i < times; i++) {
		const attempt = await throttlePreAuth(headers, key);
		await attempt.verify(reject);
	}
}

beforeEach(() => {
	store.current = createMemoryRateLimitStore();
	config.apiConfig.rateLimit.enabled = true;
	config.apiConfig.rateLimit.trustProxyHeaders = true;
});

describe("throttlePreAuth", () => {
	it("allows the failure budget, then answers 429 with Retry-After", async () => {
		await fail("partner", 2);
		const { limited } = await throttlePreAuth(headers, "partner");
		expect(limited?.status).toBe(429);
		expect(limited?.headers.get("retry-after")).toBe("60");
		expect(await limited?.json()).toEqual({ error: "rate_limited" });
	});

	it("never counts successful verifications", async () => {
		for (let i = 0; i < 10; i++) {
			const attempt = await throttlePreAuth(headers, "partner");
			expect(attempt.limited).toBeNull();
			await expect(attempt.verify(accept)).resolves.toEqual({
				orgId: "org-1",
			});
		}
		await fail("partner", 1);
		expect((await throttlePreAuth(headers, "partner")).limited).toBeNull();
	});

	it("counts a thrown 401 as a failure and rethrows it", async () => {
		const unauthorized = Object.assign(new Error("invalid_api_key"), {
			status: 401,
		});
		for (let i = 0; i < 2; i++) {
			const attempt = await throttlePreAuth(headers, "partner");
			await expect(
				attempt.verify(() => Promise.reject(unauthorized)),
			).rejects.toBe(unauthorized);
		}
		expect((await throttlePreAuth(headers, "partner")).limited?.status).toBe(
			429,
		);
	});

	it("does not count other errors (e.g. 402 upgrade_required)", async () => {
		const upgrade = Object.assign(new Error("upgrade_required"), {
			status: 402,
		});
		for (let i = 0; i < 3; i++) {
			const attempt = await throttlePreAuth(headers, "partner");
			await expect(attempt.verify(() => Promise.reject(upgrade))).rejects.toBe(
				upgrade,
			);
		}
		expect((await throttlePreAuth(headers, "partner")).limited).toBeNull();
	});

	it("keeps separate budgets per key", async () => {
		await fail("partner", 2);
		expect((await throttlePreAuth(headers, "ingest")).limited).toBeNull();
	});

	it("accepts a per-route limit", async () => {
		const limit = { maxRequests: 1, windowMs: 60_000 };
		const attempt = await throttlePreAuth(headers, "strict", limit);
		await attempt.verify(reject);
		expect(
			(await throttlePreAuth(headers, "strict", limit)).limited?.status,
		).toBe(429);
	});

	it("never throttles when the client IP is not trusted", async () => {
		config.apiConfig.rateLimit.trustProxyHeaders = false;
		await fail("partner", 10);
		expect((await throttlePreAuth(headers, "partner")).limited).toBeNull();
	});

	it("never throttles when the IP is trusted but unknown", async () => {
		const noIp = new Headers();
		for (let i = 0; i < 10; i++) {
			const attempt = await throttlePreAuth(noIp, "partner");
			expect(attempt.limited).toBeNull();
			await attempt.verify(reject);
		}
	});

	it("is off when rate limiting is disabled", async () => {
		config.apiConfig.rateLimit.enabled = false;
		await fail("partner", 10);
		expect((await throttlePreAuth(headers, "partner")).limited).toBeNull();
	});
});

describe("warning without trusted client IPs", () => {
	const scope = globalThis as Record<symbol, unknown>;
	/** A fresh module instance, as in another Next.js bundle. */
	const freshThrottle = async () => {
		vi.resetModules();
		return (await import("../pre-auth-throttle")).throttlePreAuth;
	};

	beforeEach(() => {
		warn.mockClear();
		delete scope[WARNED];
		envState.NODE_ENV = "production";
	});

	afterEach(() => {
		envState.NODE_ENV = "test";
		delete scope[WARNED];
	});

	it("does not read the config at import (partial config mocks keep working)", async () => {
		config.apiConfig.rateLimit.trustProxyHeaders = false;
		await freshThrottle();
		expect(warn).not.toHaveBeenCalled();
	});

	it("warns once per process in production that TRUST_PROXY_HEADERS is needed", async () => {
		config.apiConfig.rateLimit.trustProxyHeaders = false;
		const first = await freshThrottle();
		await first(headers, "orpc");
		await first(headers, "mcp");
		await (await freshThrottle())(headers, "orpc");
		expect(warn).toHaveBeenCalledTimes(1);
		expect(String(warn.mock.calls[0]?.[0])).toContain("TRUST_PROXY_HEADERS");
	});

	it("stays quiet with trusted client IPs", async () => {
		await (await freshThrottle())(headers, "orpc");
		expect(warn).not.toHaveBeenCalled();
	});

	it("stays quiet outside production", async () => {
		config.apiConfig.rateLimit.trustProxyHeaders = false;
		envState.NODE_ENV = "development";
		await (await freshThrottle())(headers, "orpc");
		expect(warn).not.toHaveBeenCalled();
	});

	it("stays quiet when rate limiting is disabled", async () => {
		config.apiConfig.rateLimit.trustProxyHeaders = false;
		config.apiConfig.rateLimit.enabled = false;
		await (await freshThrottle())(headers, "orpc");
		expect(warn).not.toHaveBeenCalled();
	});
});
