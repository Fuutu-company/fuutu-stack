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
