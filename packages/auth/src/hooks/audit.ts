/**
 * Audit-log hooks for authentication lifecycle events.
 *
 * Routed through `@fuutu/logs` → `createAuditLogger` so that:
 *   1. events persist via the active `AuditSink` (Prisma in production,
 *      console otherwise),
 *   2. the same event is mirrored to the console for dev visibility.
 *
 * Sink failures are swallowed inside the logger — auth flows never
 * block on audit-log infrastructure.
 */
import { createAuditLogger } from "@fuutu/logs";

const audit = createAuditLogger({ scope: "auth" });

export type AuditableUser = {
	id: string;
};

export type AuditableSession = {
	userId: string;
	activeOrganizationId?: string | null;
	ipAddress?: string | null;
	userAgent?: string | null;
	/** Set on sessions started by `admin.users.impersonate` (admin user id). */
	impersonatedBy?: string | null;
};

/**
 * Records a sign-up event. PII (email, name, …) is intentionally NOT
 * persisted here — the `AuditLog` table is append-only and outside the
 * normal GDPR delete-user flow; any subject data stays on the `User`
 * row (which is erasable) and is joined at read time via `userId`.
 */
export async function logSignUp(user: AuditableUser): Promise<void> {
	await audit.record({
		userId: user.id,
		action: "auth.sign_up",
	});
}

/**
 * Recorded by Better-Auth's `session.create.after` hook. Each row is
 * one new session — that covers interactive sign-in, multi-session
 * logins, and impersonation starts. Session *refreshes* extend the
 * existing row via `update` and do not produce audit noise here.
 * An impersonation start stays out of the customer's organization log
 * and carries no IP/user agent — those belong to support staff.
 */
export async function logSessionCreated(
	session: AuditableSession,
): Promise<void> {
	if (session.impersonatedBy) {
		await audit.record({
			userId: session.userId,
			organizationId: null,
			action: "auth.session_created",
			ip: null,
			userAgent: null,
			metadata: { impersonatedBy: session.impersonatedBy },
		});
		return;
	}
	await audit.record({
		userId: session.userId,
		organizationId: session.activeOrganizationId ?? null,
		action: "auth.session_created",
		ip: session.ipAddress ?? null,
		userAgent: session.userAgent ?? null,
	});
}

/** Why account recovery revoked a user's API keys. */
export type ApiKeyRevocationReason = "password_reset" | "mailbox_proof";

/**
 * Account recovery (password reset, a mailbox proof taking over an
 * unverified account) revokes every live key of the user, org keys
 * included — CI and server integrations stop. Recorded so it is not
 * silent; only the count, never key ids or material.
 */
export async function logApiKeysRevoked(input: {
	userId: string;
	count: number;
	reason: ApiKeyRevocationReason;
}): Promise<void> {
	if (input.count <= 0) return;
	await audit.record({
		userId: input.userId,
		organizationId: null,
		action: "auth.api_keys_revoked",
		metadata: { count: input.count, reason: input.reason },
	});
}
