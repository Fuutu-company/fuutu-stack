/**
 * @fuutu/logs/orpc — evlog oRPC integration re-export.
 *
 * Usage in the API package:
 * ```ts
 * import { evlog, withEvlog, type EvlogOrpcContext } from "@fuutu/logs/orpc";
 *
 * const base = os.$context<EvlogOrpcContext>().use(evlog());
 * // context.log in every procedure → wide event per request
 * ```
 */
export { type EvlogOrpcContext, evlog, useLogger, withEvlog } from "evlog/orpc";
