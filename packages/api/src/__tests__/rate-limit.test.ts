import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Boot-time validation: when REDIS_URL is set the app must refuse to boot
 * because the Redis rate-limit driver is still a v1 stub (see
 * @fuutu/utils/rate-limit). A per-request throw would only surface the
 * misconfiguration as 500s in production traffic.
 */

const MODULE_PATH = "../orpc/middleware/rate-limit";

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
});

describe("rate-limit middleware boot validation", () => {
	it("throws at import time when REDIS_URL is set (stub driver)", async () => {
		vi.resetModules();
		vi.stubEnv("REDIS_URL", "redis://localhost:6379");

		await expect(import(MODULE_PATH)).rejects.toThrow(
			"Redis rate-limit driver is a v1 stub",
		);
	});

	it("boot error tells the operator how to resolve it", async () => {
		vi.resetModules();
		vi.stubEnv("REDIS_URL", "redis://localhost:6379");

		await expect(import(MODULE_PATH)).rejects.toThrow(
			"implement createRedisRateLimitStore or unset REDIS_URL",
		);
	});

	it("imports cleanly when REDIS_URL is unset", async () => {
		vi.resetModules();
		vi.stubEnv("REDIS_URL", "");

		const mod = await import(MODULE_PATH);
		expect(typeof mod.createRateLimitMiddleware).toBe("function");
	});
});

describe("rate-limit buckets", () => {
	type Limit = { maxRequests: number; windowMs: number };
	const recordingStore = () => {
		const counts = new Map<string, number>();
		return {
			keys: counts,
			async check(key: string, limit: Limit) {
				const n = (counts.get(key) ?? 0) + 1;
				counts.set(key, n);
				return {
					allowed: n <= limit.maxRequests,
					remaining: Math.max(0, limit.maxRequests - n),
					resetAt: Date.now() + limit.windowMs,
				};
			},
		};
	};
	const context = {
		session: { user: { id: "user-1" } },
		headers: new Headers(),
	} as never;
	const next = async () => "ok";

	it("gives each endpoint its own budget for the same user", async () => {
		vi.resetModules();
		vi.stubEnv("REDIS_URL", "");
		const { createRateLimitMiddleware } = await import(MODULE_PATH);
		const store = recordingStore();
		const chat = createRateLimitMiddleware({
			endpoint: "aiChat",
			store,
			maxRequests: 1,
		});
		const keys = createRateLimitMiddleware({
			endpoint: "apiKeyMutation",
			store,
			maxRequests: 1,
		});

		await expect(chat({ context, next })).resolves.toBe("ok");
		// a different endpoint must not be blocked by the chat call
		await expect(keys({ context, next })).resolves.toBe("ok");
		// the same endpoint is limited
		await expect(chat({ context, next })).rejects.toThrow(
			/Rate limit exceeded/,
		);
		expect([...store.keys.keys()].sort()).toEqual([
			"aiChat:user-1",
			"apiKeyMutation:user-1",
		]);
	});
});
