/**
 * @fuutu/logs/next — evlog Next.js integration re-export.
 *
 * Usage in the SaaS app:
 * ```ts
 * import { createEvlog, useLogger, createError } from "@fuutu/logs/next";
 *
 * export const { withEvlog, useLogger, log, createError } = createEvlog({
 *   service: "saas",
 * });
 * ```
 */
export {
	createError,
	createError as createEvlogError,
	createEvlog,
	type EvlogMiddlewareConfig,
	evlogMiddleware,
	type NextEvlogOptions,
	useLogger,
} from "evlog/next";
