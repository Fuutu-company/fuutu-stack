import type { ProcedurePolicyExceptions, RoutePolicy } from "./api-policy";

/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Your API's security policy, merged with the kit's (`./api-policy.ts`)
 * and checked by the router-policy and route-registry tests:
 *
 * - every oRPC mutation is rate-limited (`createRateLimitMiddleware`);
 * - mutations under a sensitive prefix (money, credentials, org structure)
 *   also reject impersonation (`denyImpersonation`) and API keys
 *   (`sessionOnly`) — add your module's prefix below;
 * - every Hono route (`custom-routes.ts`) is listed with how it
 *   authenticates, its body limit and rate limit, and whether the saas
 *   proxy lets it through without a session (`proxy-public.ts`).
 *
 * ```ts
 * export const appSensitiveProcedurePrefixes = ["invoicing."];
 * export const appProcedurePolicyExceptions = {
 *   "invoicing.preview": { rateLimit: "read-only; POST only for the body size" },
 * };
 * export const appRoutePolicies = [
 *   {
 *     path: "/api/v1/status",
 *     methods: ["GET"],
 *     auth: "api-key",
 *     reason: "requireApiKey(headers, \"api\")",
 *     bodyLimit: { none: "GET, no body is read" },
 *     rateLimit: "per key (defaultRateLimitStore)",
 *     proxyPublic: true,
 *   },
 * ];
 * ```
 */

/** Procedure path prefixes whose mutations are session-only and deny impersonation. */
export const appSensitiveProcedurePrefixes: readonly string[] = [];

/** Procedure path → guards it deliberately lacks, each with its reason. */
export const appProcedurePolicyExceptions: ProcedurePolicyExceptions = {};

/** One entry per route mounted in `custom-routes.ts`. */
export const appRoutePolicies: readonly RoutePolicy[] = [];

/** Procedure path prefixes of your back office — every procedure under them (reads too) is a `systemAdminProcedure`. */
export const appSystemAdminProcedurePrefixes: readonly string[] = [];
