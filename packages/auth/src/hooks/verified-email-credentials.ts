/**
 * Credentials that survive a password change need a proven mailbox. With
 * `requireEmailVerification` off anyone can sign up with someone else's
 * address; when the owner later proves the mailbox (magic link), Better
 * Auth removes the squatter's password and sessions — but a passkey or a
 * TOTP secret registered before would keep signing the squatter in (and
 * a squatter's 2FA would lock the owner out). `hooks.before` guard:
 * verify the email first.
 */
import { APIError } from "better-auth/api";

const CREDENTIAL_PATHS: ReadonlySet<string> = new Set([
	"/passkey/generate-register-options",
	"/passkey/verify-registration",
	"/two-factor/enable",
]);

type SessionLookup = () => Promise<{
	user: { emailVerified?: boolean | null };
} | null>;

/** Throws `APIError("FORBIDDEN")` (code `EMAIL_NOT_VERIFIED`). */
export async function assertVerifiedEmailForCredential(input: {
	path: string | undefined;
	getSession: SessionLookup;
}): Promise<void> {
	if (!input.path || !CREDENTIAL_PATHS.has(input.path)) return;
	const session = await input.getSession();
	if (!session || session.user.emailVerified === true) return;
	throw new APIError("FORBIDDEN", {
		message: "Verify your email address first",
		code: "EMAIL_NOT_VERIFIED",
	});
}
