import type { Hono } from "hono";
import type { BlankSchema } from "hono/types";

/** The kit's Hono app (base path `/api`) as seen by `mountCustomRoutes`. */
export type ApiApp = Hono<
	{ Variables: { evlogWideEvent: boolean } },
	BlankSchema,
	"/api"
>;

/**
 * App-owned Hono routes — add yours here instead of editing `app.ts`.
 *
 * Mounted after the kit middleware (request log, `X-Framework` fingerprint,
 * CORS, CSRF origin guard) and the kit's machine routes, but BEFORE the
 * session context and oRPC dispatch — so these routes get no session and
 * must authenticate themselves, e.g. with
 * `requireApiKey(c.req.raw.headers, "<scope>")`, a signed webhook secret or
 * a shared bearer. Paths are relative to `/api`:
 *
 * ```ts
 * app.get("/v1/status", async (c) => {
 *   const attempt = await throttlePreAuth(c.req.raw.headers, "status");
 *   if (attempt.limited) return attempt.limited;
 *   const { orgId } = await attempt.verify(() =>
 *     requireApiKey(c.req.raw.headers, "api"),
 *   );
 *   return c.json({ orgId });
 * });
 * ```
 *
 * `throttlePreAuth` (`./pre-auth-throttle`) counts rejected keys per
 * client IP and answers 429 BEFORE `requireApiKey` looks a key up once an
 * IP is over the budget — without it, a flood of random keys costs one DB
 * lookup each. Use it on every route that verifies a credential (needs
 * `TRUST_PROXY_HEADERS`; without trusted client IPs it is a no-op).
 *
 * No rate limit by default — oRPC's `createRateLimitMiddleware` does not
 * run here. Add one per route with the shared store, keyed per caller:
 *
 * ```ts
 * import { defaultRateLimitStore } from "@fuutu/utils/rate-limit";
 * import { apiConfig } from "./config";
 *
 * app.post("/v1/ingest", async (c) => {
 *   const { keyId } = await requireApiKey(c.req.raw.headers, "api");
 *   if (apiConfig.rateLimit.enabled) {
 *     const { allowed } = await defaultRateLimitStore.check(
 *       `custom:ingest:${keyId}`,
 *       apiConfig.rateLimit.defaults,
 *     );
 *     if (!allowed) return c.json({ error: "rate_limited" }, 429);
 *   }
 *   return c.json({ ok: true });
 * });
 * ```
 *
 * Anonymous routes key on `getClientIp(c.req.raw.headers)` (`./client-ip`).
 *
 * Never reuse a path an oRPC/REST procedure owns (`/webhooks`, `/api-keys`,
 * `/rpc/*`, …; see `/api/docs`): these routes are mounted first, so they
 * shadow the procedure and skip `authProcedure` — its permission, plan and
 * rate-limit checks never run. Prefix app routes, e.g. `/v1/…`.
 *
 * Browser-facing paths that must skip the saas login redirect also need an
 * entry in `apps/saas/src/proxy-public.ts`. For session-authenticated
 * endpoints, prefer an oRPC procedure (typed client + OpenAPI).
 */
export function mountCustomRoutes(_app: ApiApp): void {}
