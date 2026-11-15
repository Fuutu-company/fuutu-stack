/**
 * Support impersonation must not change who owns the account, spend the
 * user's money, hand third parties access or switch sessions. This `hooks.before` guard
 * rejects those Better Auth endpoints for a session started by
 * `admin.users.impersonate` (`session.impersonatedBy` set) — HTTP and
 * server-side `auth.api.*` calls alike. oRPC procedures opt in with
 * `authProcedure({ denyImpersonation: true })` (@fuutu/api).
 */
import { APIError } from "better-auth/api";

const GUARDED_PATHS: ReadonlySet<string> = new Set([
	"/change-email",
	"/change-password",
	"/link-social",
	"/unlink-account",
	"/oauth2/authorize",
	"/oauth2/consent",
	"/oauth2/continue",
	"/oauth2/update-consent",
	"/oauth2/create-client",
	"/organization/leave",
	"/organization/delete",
	"/organization/invite-member",
	"/organization/accept-invitation",
	// Provider tokens of the user's linked accounts.
	"/get-access-token",
	"/refresh-token",
	"/account-info",
	"/oauth2/client/rotate-secret",
	"/oauth2/update-client",
	// Switching device sessions would leave the impersonation without the
	// audited stop (`admin.impersonation.stop`).
	"/multi-session/set-active",
	"/multi-session/revoke",
]);

const GUARDED_PREFIXES = ["/delete-user", "/two-factor/", "/passkey/"];

function isGuardedPath(path: string): boolean {
	return (
		GUARDED_PATHS.has(path) ||
		GUARDED_PREFIXES.some((prefix) => path.startsWith(prefix))
	);
}

type SessionLookup = () => Promise<{
	session: { impersonatedBy?: string | null };
} | null>;

/**
 * Throws `APIError("FORBIDDEN")` (code `IMPERSONATION_FORBIDDEN`) when a
 * guarded endpoint is called with an impersonation session. The session
 * is only read for guarded paths.
 */
export async function assertNotImpersonating(input: {
	path: string | undefined;
	getSession: SessionLookup;
}): Promise<void> {
	if (!input.path || !isGuardedPath(input.path)) return;
	const session = await input.getSession();
	if (!session?.session.impersonatedBy) return;
	throw new APIError("FORBIDDEN", {
		message: "Not allowed while impersonating a user",
		code: "IMPERSONATION_FORBIDDEN",
	});
}
