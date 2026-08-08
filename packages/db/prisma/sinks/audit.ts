/**
 * Prisma-backed AuditSink implementation.
 *
 * Registered at app boot via `setAuditSink(prismaAuditSink)` so that
 * every `createAuditLogger(...).record(...)` call across the monorepo
 * persists to the canonical `AuditLog` Postgres table.
 */
import type { AuditSink } from "@fuutu/logs";
import { createAuditLog } from "../queries/audit-log";

export const prismaAuditSink: AuditSink = {
	async record(event) {
		await createAuditLog({
			userId: event.userId ?? null,
			action: event.action,
			ip: event.ip ?? null,
			userAgent: event.userAgent ?? null,
			metadata: event.metadata as Parameters<
				typeof createAuditLog
			>[0]["metadata"],
		});
	},
};
