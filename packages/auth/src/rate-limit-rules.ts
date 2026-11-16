/** A Better Auth `rateLimit.customRules` entry: `false` = not limited. */
type RateLimitRule = (
	request: Request,
	current: { window: number; max: number },
) => { window: number; max: number } | false;

/**
 * Read-only GETs the app repeats on every page and while polling. Better
 * Auth only resets a path's count after a full idle window, so steady
 * reads used up the global budget (`rateLimiting.max`) and answered 429.
 */
const RATE_LIMIT_FREE_READS = ["/get-session", "/organization/list"] as const;

/**
 * The full-org read returns members and invitations, so it is not exempt:
 * a short burst limit (30 per 2 seconds) still lets polling pages through.
 */
const ORGANIZATION_READ_PATH = "/organization/get-full-organization";
const ORGANIZATION_READ_LIMIT = { window: 2, max: 30 } as const;

/**
 * `rateLimit.customRules` for the read paths. Better Auth matches a key
 * without `*` exactly against the request path; the rule then checks the
 * method: a GET on `RATE_LIMIT_FREE_READS` is not counted, a GET on
 * `get-full-organization` gets the burst limit, any other method keeps
 * the current limit.
 */
export function readOnlyRateLimitRules(): Record<string, RateLimitRule> {
	const freeRead: RateLimitRule = (request, current) =>
		request.method === "GET" ? false : current;
	const organizationRead: RateLimitRule = (request, current) =>
		request.method === "GET" ? { ...ORGANIZATION_READ_LIMIT } : current;
	return {
		...Object.fromEntries(
			RATE_LIMIT_FREE_READS.map((path) => [path, freeRead]),
		),
		[ORGANIZATION_READ_PATH]: organizationRead,
	};
}
