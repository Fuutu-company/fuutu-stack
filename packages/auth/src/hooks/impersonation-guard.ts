/**
 * Support impersonation must not change who owns the account, spend the
 * user's money or hand third parties access. This `hooks.before` guard
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
