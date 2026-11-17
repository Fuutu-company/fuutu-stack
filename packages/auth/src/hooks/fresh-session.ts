/**
 * Account-takeover steps need a recent sign-in: a stolen session cookie
 * alone must not move the account to another mailbox. `hooks.before`
 * guard; the limit is `authConfig.session.freshSessionMaxAge`. Better
 * Auth's own `session.freshAge` stays at its default because it also
 * gates `/list-sessions` (the settings sessions list).
 */
import { APIError } from "better-auth/api";
import { authConfig } from "../config";

const FRESH_SESSION_PATHS: ReadonlySet<string> = new Set([
	"/change-email",
	// A new passkey signs in later without password or 2FA code.
	"/passkey/generate-register-options",
	"/passkey/verify-registration",
]);

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
	assertSessionSignedInRecently(session.session.createdAt, input);
}

/** Throws `SESSION_NOT_FRESH` unless the session was created recently. */
export function assertSessionSignedInRecently(
	createdAt: Date | string,
	options: { maxAgeSeconds?: number; now?: number } = {},
): void {
	const maxAge =
		(options.maxAgeSeconds ?? authConfig.session.freshSessionMaxAge) * 1000;
	const signedInAt = new Date(createdAt).getTime();
	if ((options.now ?? Date.now()) - signedInAt < maxAge) return;
	throw new APIError("FORBIDDEN", {
		message: "Sign in again to continue",
		code: "SESSION_NOT_FRESH",
	});
}
