import {
	defaultRateLimitStore,
	type RateLimitStore,
} from "@fuutu/utils/rate-limit";
import { ORPCError } from "@orpc/server";
import { apiConfig } from "../../config";
import type { Context } from "../../context";

type RateLimitEndpoint = keyof typeof apiConfig.rateLimit.endpoints;

type RateLimitOptions = {
	endpoint?: RateLimitEndpoint;
	maxRequests?: number;
	windowMs?: number;
	keyGenerator?: (context: Context) => string;
	/**
	 * Override the store (memory default). Swap in Redis for multi-node
	 * deployments via `@fuutu/utils/rate-limit`.
	 */
	store?: RateLimitStore;
};

/**
 * Creates a rate limit middleware with automatic config selection.
 *
 * @param options - Configuration options
 * @param options.endpoint - Endpoint key from config (e.g., 'aiChat', 'userUpdate')
 * @param options.maxRequests - Override max requests (optional)
 * @param options.windowMs - Override window in ms (optional)
 * @param options.keyGenerator - Custom key generator (optional)
 *
 * @example
 * // Use predefined endpoint config
 * .use(createRateLimitMiddleware({ endpoint: 'aiChat' }))
 *
 * // Use defaults
 * .use(createRateLimitMiddleware())
 *
 * // Custom override
 * .use(createRateLimitMiddleware({ maxRequests: 5, windowMs: 10000 }))
 */
// biome-ignore lint/suspicious/noExplicitAny: oRPC's MiddlewareResult is a deeply-generic intersection; over-typing `next` here breaks procedure inference at every call site.
type OrpcNext = (...args: any[]) => any;

export function createRateLimitMiddleware(options: RateLimitOptions = {}) {
	return async ({ context, next }: { context: Context; next: OrpcNext }) => {
		if (!apiConfig.rateLimit.enabled) {
			return next();
		}

		// Determine rate limit config
		let maxRequests: number;
		let windowMs: number;

		if (options.endpoint && apiConfig.rateLimit.endpoints[options.endpoint]) {
			// Use endpoint-specific config
			const endpointConfig = apiConfig.rateLimit.endpoints[options.endpoint];
			maxRequests = options.maxRequests ?? endpointConfig.maxRequests;
			windowMs = options.windowMs ?? endpointConfig.windowMs;
		} else {
			// Use defaults or manual overrides
			maxRequests =
				options.maxRequests ?? apiConfig.rateLimit.defaults.maxRequests;
			windowMs = options.windowMs ?? apiConfig.rateLimit.defaults.windowMs;
		}

		// Generate rate limit key
		const key = options.keyGenerator
			? options.keyGenerator(context)
			: (context.session?.user?.id ??
				context.headers.get("x-forwarded-for") ??
				context.headers.get("x-real-ip") ??
				"anonymous");

		const store = options.store ?? defaultRateLimitStore;
		const result = await store.check(key, { maxRequests, windowMs });

		if (!result.allowed) {
			const resetInSeconds = Math.max(
				1,
				Math.ceil((result.resetAt - Date.now()) / 1000),
			);
			throw new ORPCError("TOO_MANY_REQUESTS", {
				message: `Rate limit exceeded. Try again in ${resetInSeconds} seconds.`,
			});
		}

		return next();
	};
}
