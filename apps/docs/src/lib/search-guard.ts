import {
	defaultRateLimitStore,
	type RateLimitStore,
} from "@fuutu/utils/rate-limit";

/** Longer queries are refused before the index runs. */
export const SEARCH_QUERY_MAX_LENGTH = 200;
/** Searches per client IP (or the shared bucket) and window. */
export const SEARCH_RATE_LIMIT = { maxRequests: 60, windowMs: 60 * 1000 };

type Handler = (request: Request) => Promise<Response>;

/**
 * Client IP from a trusted reverse proxy, or null. Same rule as
 * `getClientIp` in `@fuutu/api` (a public app must not import it): the
 * right-most `X-Forwarded-For` entry is the one the proxy appended.
 */
function clientIp(headers: Headers, trustProxyHeaders: boolean) {
	if (!trustProxyHeaders) return null;
	const forwarded = headers
		.get("x-forwarded-for")
		?.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean)
		.at(-1);
	return forwarded || headers.get("x-real-ip")?.trim() || null;
}

/**
 * Wraps the public search endpoint: caps the query length and limits each
 * client IP — one shared bucket without trusted proxy headers, so forged
 * `X-Forwarded-For` values cannot mint fresh budgets.
 */
export function guardSearch(
	handler: Handler,
	options: { trustProxyHeaders: boolean; store?: RateLimitStore },
): Handler {
	const store = options.store ?? defaultRateLimitStore;
	return async (request) => {
		const query = new URL(request.url).searchParams.get("query") ?? "";
		if (query.length > SEARCH_QUERY_MAX_LENGTH) {
			return Response.json({ error: "query_too_long" }, { status: 400 });
		}
		const caller =
			clientIp(request.headers, options.trustProxyHeaders) ?? "anonymous";
		const { allowed, resetAt } = await store.check(
			`docsSearch:${caller}`,
			SEARCH_RATE_LIMIT,
		);
		if (!allowed) {
			const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
			return Response.json(
				{ error: "rate_limited" },
				{ status: 429, headers: { "retry-after": String(retryAfter) } },
			);
		}
		return handler(request);
	};
}
