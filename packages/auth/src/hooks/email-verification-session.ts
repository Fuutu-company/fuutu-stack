/**
 * The sign-up verification link (`/verify-email`, token without
 * `requestType`) only counts in a browser signed in as that same user.
 * Better Auth verifies whoever owns the row: with
 * `requireEmailVerification` off, a squatter signs up with someone
 * else's address, and the owner's click on the genuine mail would hand
 * the squatter a verified account (passkey, 2FA and API-key gates open).
 * The owner knows the password, the squatter's victim does not — so the
 * account stays unverified and the magic-link cleanup
 * (unproven-credentials.ts) still applies.
 *
 * `hooks.before` guard. A link opened without that session goes to the
 * app's verify page with token and landing page intact; the page sends a
 * signed-out visitor to sign-in and back. Change-email tokens
 * (`requestType`) are left to Better Auth. Off with
 * `requireEmailVerification`: an unverified account cannot sign in then
 * (neither can a squatter), so the link must work without a session.
 */
import { APIError } from "better-auth/api";
import { verifyJWT } from "better-auth/crypto";

/** App page that verifies by fetch and handles the sign-in round trip. */
export const EMAIL_VERIFICATION_PAGE = "/auth/verify";

type SessionLookup = () => Promise<{ user: { email: string } } | null>;

/**
 * Throws a redirect to the verify page (link opened with `callbackURL`),
 * `APIError("UNAUTHORIZED")` code `SIGN_IN_TO_VERIFY_EMAIL` without a
 * session, or `APIError("FORBIDDEN")` code `EMAIL_VERIFICATION_OTHER_ACCOUNT`
 * with another user's session.
 */
export async function assertSessionForEmailVerification(input: {
	/** False with `authConfig.signup.requireEmailVerification`. */
	enabled: boolean;
	path: string | undefined;
	query: Record<string, unknown> | undefined;
	secret: string;
	appBaseUrl: string;
	getSession: SessionLookup;
	redirect: (url: string) => Error;
}): Promise<void> {
	if (!input.enabled || input.path !== "/verify-email") return;
	const token = input.query?.token;
	if (typeof token !== "string") return;
	const payload = await verifyJWT<{ email?: unknown; requestType?: unknown }>(
		token,
		input.secret,
	);
	// Invalid or expired tokens: Better Auth answers with its own error.
	if (!payload || typeof payload.email !== "string") return;
	if (payload.requestType !== undefined) return;
	const session = await input.getSession();
	if (session?.user.email.toLowerCase() === payload.email.toLowerCase()) {
		return;
	}
	const callbackURL = input.query?.callbackURL;
	if (typeof callbackURL === "string") {
		const page = new URL(EMAIL_VERIFICATION_PAGE, input.appBaseUrl);
		page.searchParams.set("token", token);
		page.searchParams.set("callbackURL", callbackURL);
		throw input.redirect(page.toString());
	}
	if (!session) {
		throw new APIError("UNAUTHORIZED", {
			message: "Sign in to verify your email address",
			code: "SIGN_IN_TO_VERIFY_EMAIL",
		});
	}
	throw new APIError("FORBIDDEN", {
		message: "This verification link belongs to another account",
		code: "EMAIL_VERIFICATION_OTHER_ACCOUNT",
	});
}
