import type {
	AuditEvent,
	AuditLogger,
	AuditSink,
	LoggerOptions,
} from "./types";

/**
 * Default AuditSink for dev/local-only setups. Mirrors into console
 * so tests and the dev shell never need a DB connection. Replace at
 * boot via `setAuditSink(prismaAuditSink)` in production code.
 *
 * Uses `console.info` directly (not evlog) so this module is browser-safe
 * and doesn't pull evlog's Node-only modules into client bundles.
 */
export const consoleAuditSink: AuditSink = {
	async record(event) {
		console.info("[audit]", event.action, {
			userId: event.userId ?? null,
			ip: event.ip ?? null,
			userAgent: event.userAgent ?? null,
			metadata: event.metadata ?? {},
		});
	},
};

// Active sink — mutable so `setAuditSink()` can swap it at boot time.
let activeAuditSink: AuditSink = consoleAuditSink;

export function setAuditSink(sink: AuditSink): void {
	activeAuditSink = sink;
}

export function getAuditSink(): AuditSink {
	return activeAuditSink;
}

/**
 * Persistent audit-log writer. Each `.record()` call:
 *  1. persists the event via the active `AuditSink` (source of truth),
 *  2. mirrors an `info` line through console so the event is also visible
 *     in the dev/ops log stream.
 *
 * Sink failures never throw — they surface as `error` logs — so auth
 * flows are not blocked by audit infrastructure outages.
 */
export function createAuditLogger(options: LoggerOptions = {}): AuditLogger {
	const { scope } = options;
	const tag = scope ?? "audit";

	return {
		async record(event: AuditEvent) {
			try {
				await activeAuditSink.record(event);
			} catch (error) {
				console.error(`[${tag}] audit sink failure`, {
					action: event.action,
					error: error instanceof Error ? error.message : String(error),
				});
			}
			console.info(`[${tag}] audit: ${event.action}`, {
				userId: event.userId ?? null,
				ip: event.ip ?? null,
				userAgent: event.userAgent ?? null,
				...(event.metadata ?? {}),
			});
		},
	};
}
