/**
 * Ends a support impersonation past `authConfig.admin.impersonationMinutes`
 * (`isImpersonationExpired`) — called by every detector: the API context
 * and the app's server guards. Server-only.
 */
import { adminRevokeUserSession } from "@fuutu/db";
import { createAuditLogger, createLogger } from "@fuutu/logs";

const log = createLogger({ scope: "auth:impersonation" });

export type ExpiredImpersonationSession = {
	id: string;
	userId: string;
	impersonatedBy?: string | null;
};

/**
 * Deletes the impersonation session row and records
 * `admin.user.impersonate_expired` (actor: the impersonating admin) — only
 * when this call removed the row, so the first detector audits and later
 * ones (cookie-cached sessions, parallel requests) record nothing. Never
 * throws: the caller treats the request as signed out either way.
 */
export async function endExpiredImpersonation(
	session: ExpiredImpersonationSession,
): Promise<void> {
	if (!session.impersonatedBy) return;
	try {
		const removed = await adminRevokeUserSession({
			userId: session.userId,
			sessionId: session.id,
		});
		if (removed === 0) return;
		// Created on use: the API context imports this module on every request path.
		await createAuditLogger({ scope: "admin" }).record({
			action: "admin.user.impersonate_expired",
			userId: session.impersonatedBy,
			organizationId: null,
			metadata: { targetUserId: session.userId },
		});
	} catch (error) {
		log.warn("expired impersonation could not be ended", {
			error: error instanceof Error ? error.message : String(error),
		});
	}
}
