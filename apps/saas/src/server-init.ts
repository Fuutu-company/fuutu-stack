/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Server startup hook: `instrumentation.ts` calls `registerApp()` once per
 * Node.js server process (never on the Edge runtime), after logging and
 * the payment provider are set up. Register your process-wide extensions
 * here instead of editing `instrumentation.ts`:
 *
 * ```ts
 * import { onPurchaseChanged, registerEntitlementResolver } from "@fuutu/payments";
 *
 * export async function registerApp(): Promise<void> {
 *   registerEntitlementResolver({ org: (orgId, defaults) => myEntitlement(orgId, defaults) });
 *   onPurchaseChanged(async (owner) => { await syncSeats(owner); });
 * }
 * ```
 *
 * The payments registries are shared across Next.js bundles, so a
 * registration here is visible in API routes and server components.
 * Scheduled jobs go in `packages/cron/src/app-jobs.ts` (no runtime
 * registration needed). Keep this fast and idempotent — it runs on every
 * cold start; a thrown error fails server startup. It runs once per
 * process: after editing it, restart the dev server (hot reload does not
 * re-run it).
 */
export async function registerApp(): Promise<void> {}
