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
import { logsConfig } from "./config";
import type { Logger, LoggerOptions, LogLevel, LogMeta } from "./types";

const LEVEL_ORDER: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

/**
 * LOG_LEVEL gate for the compat facade. `initLogs` also passes the level to
 * evlog as `minLevel`, but this keeps the filter working when initLogs is
 * never called (tests, scripts, minimal setups) — evlog defaults to debug.
 */
function isLevelEnabled(level: LogLevel): boolean {
	return LEVEL_ORDER[level] >= LEVEL_ORDER[logsConfig.level];
}

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

	const emit = (level: LogLevel, message: string, meta?: LogMeta): void => {
		if (!isLevelEnabled(level)) return;
		if (meta && Object.keys(meta).length > 0) {
			evlogLog[level]({ tag, message, ...meta });
		} else {
			evlogLog[level](tag, message);
		}
	};

	return {
		debug: (message: string, meta?: LogMeta) => emit("debug", message, meta),
		info: (message: string, meta?: LogMeta) => emit("info", message, meta),
		warn: (message: string, meta?: LogMeta) => emit("warn", message, meta),
		error: (message: string, meta?: LogMeta) => emit("error", message, meta),
	};
}
