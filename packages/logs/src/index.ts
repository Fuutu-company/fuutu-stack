import { consoleProvider } from "./providers/console";
import { consoleAuditSink } from "./sinks/console";
import type {
	AuditEvent,
	AuditLogger,
	AuditSink,
	Logger,
	LoggerOptions,
	LogProvider,
} from "./types";

export type {
	AuditEvent,
	AuditLogger,
	AuditSink,
	Logger,
	LoggerOptions,
	LogLevel,
	LogProvider,
} from "./types";

let activeProvider: LogProvider = consoleProvider;
let activeAuditSink: AuditSink = consoleAuditSink;

export function setLogProvider(provider: LogProvider): void {
	activeProvider = provider;
}

export function setAuditSink(sink: AuditSink): void {
	activeAuditSink = sink;
}

export function createLogger(options: LoggerOptions = {}): Logger {
	const { scope } = options;
	return {
		debug: (message, meta) =>
			activeProvider.log("debug", message, { scope, meta }),
		info: (message, meta) =>
			activeProvider.log("info", message, { scope, meta }),
		warn: (message, meta) =>
			activeProvider.log("warn", message, { scope, meta }),
		error: (message, meta) =>
			activeProvider.log("error", message, { scope, meta }),
	};
}

/**
 * Persistent audit-log writer. Each `.record()` call:
 *  1. persists the event via the active `AuditSink` (source of truth),
 *  2. mirrors an `info` line through the active `LogProvider` so the
 *     event is also visible in the dev/ops log stream.
 *
 * Sink failures never throw — they surface as `error` logs — so auth
 * flows are not blocked by audit infrastructure outages.
 */
export function createAuditLogger(options: LoggerOptions = {}): AuditLogger {
	const { scope } = options;
	return {
		async record(event: AuditEvent) {
			try {
				await activeAuditSink.record(event);
			} catch (error) {
				activeProvider.log("error", "audit sink failure", {
					scope,
					meta: { action: event.action, error },
				});
			}
			activeProvider.log("info", `audit: ${event.action}`, {
				scope,
				meta: {
					userId: event.userId ?? null,
					ip: event.ip ?? null,
					userAgent: event.userAgent ?? null,
					...(event.metadata ?? {}),
				},
			});
		},
	};
}
