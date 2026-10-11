/**
 * @fuutu/logs/wide-events — evlog wide event API re-export.
 *
 * Usage (server-side only — requires AsyncLocalStorage):
 * ```ts
 * import { useLogger, createEvlogLogger, createRequestLogger } from "@fuutu/logs/wide-events";
 *
 * // Inside a request handler (evlog/orpc or evlog/next middleware):
 * const log = useLogger();
 * log.set({ user: { id: "u123", plan: "pro" } });
 * log.set({ cart: { items: 3, total: 9999 } });
 * // → auto-emitted as one wide event at response end
 *
 * // Standalone (scripts, jobs):
 * const log = createEvlogLogger({ jobId: "sync-001" });
 * log.set({ source: "postgres", records: 1250 });
 * log.emit();
 * ```
 */

export type { DrainContext, DrainFn, LogLevel, WideEvent } from "evlog";
export {
	createLogger as createEvlogLogger,
	createRequestLogger,
	useLogger,
} from "evlog";
