import type { AuditSink } from "../types";

/**
 * Default AuditSink for dev/local-only setups. Mirrors into console
 * so tests and the dev shell never need a DB connection. Replace at
 * boot via `setAuditSink(prismaAuditSink)` in production code.
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
