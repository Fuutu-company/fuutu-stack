import { authConfig } from "@fuutu/auth/config";
import { ORPCError } from "@orpc/server";

/**
 * An API key outlives the session that created it (and a password reset),
 * so only the proven owner of the account may mint one: with
 * `requireEmailVerification` off, an unverified account may belong to
 * someone who signed up with another person's address. `data.code`
 * matches Better Auth's guard so the UI can say why.
 */
export function assertVerifiedEmail(user: {
	emailVerified?: boolean | null;
}): void {
	if (user.emailVerified === true) return;
	throw new ORPCError("FORBIDDEN", {
		message: "Verify your email address first",
		data: { code: "EMAIL_NOT_VERIFIED" },
	});
}

/**
 * Minting a key needs a recent sign-in (`authConfig.session.
 * freshSessionMaxAge`, like an email change or a new passkey): a stolen
 * session cookie alone must not turn into a credential that outlives the
 * session and a password reset.
 */
export function assertFreshSession(
	session: { createdAt: Date | string } | null | undefined,
	now: number = Date.now(),
): void {
	const maxAge = authConfig.session.freshSessionMaxAge * 1000;
	if (session && now - new Date(session.createdAt).getTime() < maxAge) return;
	throw new ORPCError("FORBIDDEN", {
		message: "Sign in again to continue",
		data: { code: "SESSION_NOT_FRESH" },
	});
}
