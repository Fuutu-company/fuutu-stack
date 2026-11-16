/**
 * Account-takeover steps need a recent sign-in: a stolen session cookie
 * alone must not move the account to another mailbox. `hooks.before`
 * guard; the limit is `authConfig.session.freshSessionMaxAge`. Better
 * Auth's own `session.freshAge` stays at its default because it also
 * gates `/list-sessions` (the settings sessions list).
 */
import { APIError } from "better-auth/api";
import { authConfig } from "../config";

const FRESH_SESSION_PATHS: ReadonlySet<string> = new Set(["/change-email"]);

type SessionLookup = () => Promise<{
	session: { createdAt: Date | string };
} | null>;

/**
 * Throws `APIError("FORBIDDEN")` (code `SESSION_NOT_FRESH`) when a
 * guarded endpoint is called from a session signed in more than
 * `maxAgeSeconds` ago. Sign in again to continue.
 */
export async function assertFreshSession(input: {
	path: string | undefined;
	getSession: SessionLookup;
	maxAgeSeconds?: number;
	now?: number;
}): Promise<void> {
	if (!input.path || !FRESH_SESSION_PATHS.has(input.path)) return;
	const session = await input.getSession();
	if (!session) return;
	const maxAge =
		(input.maxAgeSeconds ?? authConfig.session.freshSessionMaxAge) * 1000;
	const signedInAt = new Date(session.session.createdAt).getTime();
	if ((input.now ?? Date.now()) - signedInAt < maxAge) return;
	throw new APIError("FORBIDDEN", {
		message: "Sign in again to continue",
		code: "SESSION_NOT_FRESH",
	});
}
