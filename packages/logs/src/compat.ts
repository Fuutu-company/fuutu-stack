/**
 * Backward-compatibility logger — wraps evlog's `log` API into the
 * `{ debug, info, warn, error }` shape that 134+ call sites across the
 * monorepo already use.
 *
 * evlog's native `log` object has `log.info(tag, message)` and
 * `log.info({ ...event })` overloads. We map our `{ scope, meta }` pattern
 * to the wide-event form so structured metadata lands in every drain.
 */
import { log as evlogLog } from "evlog";
import type { Logger, LoggerOptions, LogMeta } from "./types";

/**
 * Create a scoped logger that delegates to evlog's global `log` instance.
 *
 * @example
 * const log = createLogger({ scope: "ai:resolve" });
 * log.info("model resolved", { model: "gpt-4o", latencyMs: 234 });
 * log.warn("no API key — fallback to noop");
 * log.error("chat failed", { err });
 *
 * // The scope becomes the evlog `tag`, meta is spread into the wide event:
 * // → evlog.log.info({ tag: "ai:resolve", message: "model resolved", model: "gpt-4o", latencyMs: 234 })
 */
export function createLogger(options: LoggerOptions = {}): Logger {
	const { scope } = options;
	const tag = scope ?? "app";

	return {
		debug: (message: string, meta?: LogMeta) => {
			if (meta && Object.keys(meta).length > 0) {
				evlogLog.debug({ tag, message, ...meta });
			} else {
				evlogLog.debug(tag, message);
			}
		},
		info: (message: string, meta?: LogMeta) => {
			if (meta && Object.keys(meta).length > 0) {
				evlogLog.info({ tag, message, ...meta });
			} else {
				evlogLog.info(tag, message);
			}
		},
		warn: (message: string, meta?: LogMeta) => {
			if (meta && Object.keys(meta).length > 0) {
				evlogLog.warn({ tag, message, ...meta });
			} else {
				evlogLog.warn(tag, message);
			}
		},
		error: (message: string, meta?: LogMeta) => {
			if (meta && Object.keys(meta).length > 0) {
				evlogLog.error({ tag, message, ...meta });
			} else {
				evlogLog.error(tag, message);
			}
		},
	};
}
