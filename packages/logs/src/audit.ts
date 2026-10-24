import { log as evlogLog } from "evlog";
import type {
	AuditEvent,
	AuditLogger,
	AuditSink,
	LoggerOptions,
} from "./types";

// Metadata keys dropped from console output — caller metadata is
// documented as PII-free, but defence-in-depth keeps obvious secrets
// out of the log stream. The persisted sink row always keeps the full
// event.
const SENSITIVE_METADATA_KEY =
	/password|secret|token|api[-_]?key|credential|session|cookie|private/i;

/** Copy of audit metadata with sensitive keys removed — for console mirrors. */
function safeMetadata(
	metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(metadata ?? {}).filter(
			([key]) => !SENSITIVE_METADATA_KEY.test(key),
		),
	);
}

/**
 * Default AuditSink for dev/local-only setups. Mirrors into console
 * so tests and the dev shell never need a DB connection. Replace at
 * boot via `setAuditSink(prismaAuditSink)` in production code.
 *
 * Uses `console.info` for the mirror (not evlog) so audit events don't
 * re-enter the log stream. The module only imports evlog's browser-safe
 * `log` object (same as compat.ts) for sink-failure reporting.
 */
export const consoleAuditSink: AuditSink = {
	async record(event) {
		console.info("[audit]", event.action, {
			userId: event.userId ?? null,
			organizationId: event.organizationId ?? null,
			ip: event.ip ?? null,
			userAgent: event.userAgent ?? null,
			metadata: safeMetadata(event.metadata),
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
				const failure = {
					action: event.action,
					error: error instanceof Error ? error.message : String(error),
				};
				// Through evlog so the failure reaches configured drains;
				// console.error stays as fallback for the drains-broken case.
				// Each call is guarded separately — a throwing logger must not
				// break the other fallback or violate the never-throw contract.
				try {
					evlogLog.error({
						tag,
						message: "audit sink failure",
						...failure,
					});
				} catch {
					// evlog itself is broken — fall through to console.
				}
				try {
					console.error(`[${tag}] audit sink failure`, failure);
				} catch {
					// Nothing left to report to.
				}
			}
			console.info(`[${tag}] audit: ${event.action}`, {
				// Metadata first — canonical fields must win on key collisions.
				...safeMetadata(event.metadata),
				userId: event.userId ?? null,
				organizationId: event.organizationId ?? null,
				ip: event.ip ?? null,
				userAgent: event.userAgent ?? null,
			});
		},
	};
}
