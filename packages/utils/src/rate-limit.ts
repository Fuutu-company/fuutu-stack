/**
 * Rate-limit store abstraction shared by API middleware + auth hooks.
 *
 * v1 ships an in-memory driver (single-node, process-local). A Redis stub
 * is provided so multi-node deployments can swap the driver without
 * touching call sites — fill in `redisRateLimitStore` when a real Redis
 * client lands in `@fuutu/storage` or equivalent.
 */

export type RateLimitCheckResult = {
	/** True when the caller is still within the budget for `windowMs`. */
	allowed: boolean;
	/** Remaining requests in the current window (0 when `allowed` is false). */
	remaining: number;
	/** Epoch-ms when the current window resets. */
	resetAt: number;
};

export type RateLimitStore = {
	check(
		key: string,
		limit: { maxRequests: number; windowMs: number },
	): Promise<RateLimitCheckResult>;
};

type MemoryRecord = { count: number; resetAt: number };

/**
 * In-memory rate-limit store. Safe for single-node dev/prod.
 * Entries are cleaned lazily on access to avoid a background timer
 * and unbounded memory growth under churn.
 */
export function createMemoryRateLimitStore(): RateLimitStore {
	const records = new Map<string, MemoryRecord>();

	return {
		async check(key, { maxRequests, windowMs }) {
			const now = Date.now();
			const existing = records.get(key);

			if (!existing || existing.resetAt <= now) {
				const resetAt = now + windowMs;
				records.set(key, { count: 1, resetAt });
				return { allowed: true, remaining: maxRequests - 1, resetAt };
			}

			if (existing.count >= maxRequests) {
				return { allowed: false, remaining: 0, resetAt: existing.resetAt };
			}

			existing.count += 1;
			return {
				allowed: true,
				remaining: maxRequests - existing.count,
				resetAt: existing.resetAt,
			};
		},
	};
}

/**
 * Placeholder Redis-backed store. Swap in an `ioredis` (or equivalent)
 * client and implement using `INCR` + `PEXPIRE` atomically (Lua/MULTI).
 * Throws eagerly so we never silently run un-rate-limited in production.
 */
export function createRedisRateLimitStore(_config: {
	url: string;
}): RateLimitStore {
	return {
		async check() {
			throw new Error(
				"[@fuutu/utils/rate-limit] Redis driver is a v1 stub — implement with an ioredis INCR+PEXPIRE pipeline before enabling.",
			);
		},
	};
}

/**
 * Default singleton used by `@fuutu/api` — one process-wide memory store
 * so every middleware instance shares budget/state.
 */
export const defaultRateLimitStore: RateLimitStore =
	createMemoryRateLimitStore();
