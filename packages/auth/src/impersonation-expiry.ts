/**
 * Ends a support impersonation past `authConfig.admin.impersonationMinutes`
 * (`isImpersonationExpired`) or whose admin lost the permission
 * (`impersonation-access`) — called by every detector: Better Auth's
 * hooks, the API context and the app's server guards. Server-only.
 */
import { adminRevokeUserSession } from "@fuutu/db";
import { createAuditLogger, createLogger } from "@fuutu/logs";

const log = createLogger({ scope: "auth:impersonation" });

export type ExpiredImpersonationSession = {
	id: string;
	userId: string;
	impersonatedBy?: string | null;
};

/** Why a support impersonation ended — each reason has its own audit action. */
export type ImpersonationEndReason = "expired" | "lost_access";

const END_AUDIT_ACTION: Record<ImpersonationEndReason, string> = {
	expired: "admin.user.impersonate_expired",
	lost_access: "admin.user.impersonate_ended_lost_access",
};

/**
 * Deletes the impersonation session row (scoped to its id and user) and
 * records the reason's audit action (actor: the impersonating admin) —
 * only when this call removed the row, so the first detector audits and
 * later ones (cookie-cached sessions, parallel requests) record nothing.
 * Never throws: the caller treats the request as signed out either way.
 */
export async function endImpersonation(
	session: ExpiredImpersonationSession,
	reason: ImpersonationEndReason,
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
			action: END_AUDIT_ACTION[reason],
			userId: session.impersonatedBy,
			organizationId: null,
			metadata: { targetUserId: session.userId },
		});
	} catch (error) {
		log.warn("impersonation could not be ended", {
			reason,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

/** `endImpersonation` past `authConfig.admin.impersonationMinutes`. */
export async function endExpiredImpersonation(
	session: ExpiredImpersonationSession,
): Promise<void> {
	await endImpersonation(session, "expired");
}
