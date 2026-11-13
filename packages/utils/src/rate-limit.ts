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
	/** Count one request against `key` and report whether it is allowed. */
	check(
		key: string,
		limit: { maxRequests: number; windowMs: number },
	): Promise<RateLimitCheckResult>;
	/**
	 * Report the state of `key` without counting a request — for budgets
	 * that only count some outcomes (e.g. failed credential checks).
	 * Optional: stores without it skip those budgets.
	 */
	peek?(
		key: string,
		limit: { maxRequests: number; windowMs: number },
	): Promise<RateLimitCheckResult>;
};

type MemoryRecord = { count: number; resetAt: number };

/**
 * In-memory rate-limit store. Safe for single-node dev/prod.
 * No background timer: once more than `sweepThreshold` keys are tracked
 * (e.g. one per client IP), expired entries are swept on the next check —
 * so key churn can't grow memory without bound.
 */
export function createMemoryRateLimitStore(
	options: { sweepThreshold?: number } = {},
): Required<RateLimitStore> {
	const records = new Map<string, MemoryRecord>();
	const sweepThreshold = options.sweepThreshold ?? 10_000;

	return {
		async check(key, { maxRequests, windowMs }) {
			const now = Date.now();
			if (records.size > sweepThreshold) {
				for (const [k, record] of records) {
					if (record.resetAt <= now) records.delete(k);
				}
			}
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
		async peek(key, { maxRequests, windowMs }) {
			const now = Date.now();
			const existing = records.get(key);
			if (!existing || existing.resetAt <= now) {
				return {
					allowed: true,
					remaining: maxRequests,
					resetAt: now + windowMs,
				};
			}
			const remaining = Math.max(0, maxRequests - existing.count);
			return { allowed: remaining > 0, remaining, resetAt: existing.resetAt };
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
}): Required<RateLimitStore> {
	const stub = async (): Promise<RateLimitCheckResult> => {
		throw new Error(
			"[@fuutu/utils/rate-limit] Redis driver is a v1 stub — implement createRedisRateLimitStore with a Redis INCR+PEXPIRE pipeline (check) and GET+PTTL (peek), or unset REDIS_URL to use the in-memory store.",
		);
	};
	return { check: stub, peek: stub };
}

/**
 * Default singleton used by `@fuutu/api` — one process-wide memory store
 * so every middleware instance shares budget/state.
 */
export const defaultRateLimitStore: RateLimitStore =
	createMemoryRateLimitStore();
