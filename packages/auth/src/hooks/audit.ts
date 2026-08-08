/**
 * Audit-log hooks for authentication lifecycle events.
 *
 * Routed through `@fuutu/logs` → `createAuditLogger` so that:
 *   1. events persist via the active `AuditSink` (Prisma in production),
 *   2. the same event is mirrored through the regular `LogProvider`
 *      stream for dev visibility.
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
	ipAddress?: string | null;
	userAgent?: string | null;
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
 */
export async function logSessionCreated(
	session: AuditableSession,
): Promise<void> {
	await audit.record({
		userId: session.userId,
		action: "auth.session_created",
		ip: session.ipAddress ?? null,
		userAgent: session.userAgent ?? null,
	});
}
