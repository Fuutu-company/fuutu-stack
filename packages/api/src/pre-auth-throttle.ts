import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import { defaultRateLimitStore } from "@fuutu/utils/rate-limit";
import { getClientIp } from "./client-ip";
import { apiConfig } from "./config";

/** Failed credential checks allowed per trusted client IP and window. */
export type PreAuthLimit = { maxRequests: number; windowMs: number };

/** One credentialed request's slot in the pre-auth budget. */
export type PreAuthAttempt = {
	/** 429 to send — the client IP is over its failure budget; `null` to continue. */
	limited: Response | null;
	/** Count one failed verification (credential rejected) against the client IP. */
	recordFailure(): Promise<void>;
	/**
	 * Run the credential check: a `null` result or a thrown error with
	 * `status: 401` (e.g. `requireApiKey`'s HTTPException) counts as a
	 * failure. Returns / rethrows the check's own result.
	 */
	verify<T>(check: () => Promise<T>): Promise<T>;
};

const log = createLogger({ scope: "api" });

// Once per process (Next.js may load this module once per bundle). Logged
// on the first credentialed request, not at import: reading the config at
// import would break every test that mocks `./config` partially.
const WARNED = Symbol.for("fuutu.api.preAuthUntrustedWarned");
const scope = globalThis as typeof globalThis & { [WARNED]?: true };
function warnUntrustedOnce(): void {
	if (scope[WARNED] || env.NODE_ENV !== "production") return;
	scope[WARNED] = true;
	log.warn(
		"pre-auth throttling is off: client IPs are untrusted. Set TRUST_PROXY_HEADERS=1 behind a reverse proxy so failed API-key/token checks are throttled per IP.",
	);
}

/** 429 JSON response with `Retry-After` (seconds until `resetAt`). */
export function rateLimitedResponse(resetAt: number): Response {
	const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
	return new Response(JSON.stringify({ error: "rate_limited" }), {
		status: 429,
		headers: {
			"content-type": "application/json",
			"retry-after": String(retryAfter),
		},
	});
}

const isUnauthorized = (error: unknown): boolean =>
	typeof error === "object" &&
	error !== null &&
	(error as { status?: unknown }).status === 401;

const unthrottled: PreAuthAttempt = {
	limited: null,
	recordFailure: async () => {},
	verify: (check) => check(),
};

/**
 * Pre-auth throttle: bounds the lookups a flood of random credentials
 * (`requireApiKey`, token checks) can cause, per client IP.
 *
 * - Only FAILED verifications count; valid credentials never consume the
 *   budget (`limit`, default `apiConfig.rateLimit.preAuth`).
 * - Once an IP is over the budget, every credentialed request from it —
 *   valid ones included — gets the 429 until the window resets.
 * - Without a trusted client IP (`TRUST_PROXY_HEADERS` off, or no
 *   forwarding header) nothing is throttled: a shared bucket would let
 *   one anonymous caller lock out every real client. The regular rate
 *   limits still apply; production logs a one-time warning (first
 *   credentialed request) when `TRUST_PROXY_HEADERS` is off.
 * - No-op when rate limiting is disabled (`FUUTU_DISABLE_RATE_LIMIT`).
 *
 * `key` names the surface (budgets are separate per key).
 *
 * ```ts
 * app.post("/v1/ingest", async (c) => {
 *   const attempt = await throttlePreAuth(c.req.raw.headers, "ingest");
 *   if (attempt.limited) return attempt.limited;
 *   const { orgId } = await attempt.verify(() =>
 *     requireApiKey(c.req.raw.headers, "api"),
 *   );
 *   …
 * });
 * ```
 */
export async function throttlePreAuth(
	headers: Headers,
	key: string,
	limit: PreAuthLimit = apiConfig.rateLimit.preAuth,
): Promise<PreAuthAttempt> {
	if (!apiConfig.rateLimit.enabled) return unthrottled;
	if (!apiConfig.rateLimit.trustProxyHeaders) {
		warnUntrustedOnce();
		return unthrottled;
	}
	const ip = getClientIp(headers, true);
	if (!ip) return unthrottled;

	// Custom stores without peek() can't count failures only — skip.
	if (!defaultRateLimitStore.peek) return unthrottled;
	const bucket = `preauth:${key}:ip:${ip}`;
	const state = await defaultRateLimitStore.peek(bucket, limit);
	const recordFailure = async () => {
		await defaultRateLimitStore.check(bucket, limit);
	};
	return {
		limited: state.allowed ? null : rateLimitedResponse(state.resetAt),
		recordFailure,
		async verify(check) {
			try {
				const result = await check();
				if (result === null) await recordFailure();
				return result;
			} catch (error) {
				if (isUnauthorized(error)) await recordFailure();
				throw error;
			}
		},
	};
}
