/**
 * Decisions of the auth link pages. A link proves nothing by itself —
 * these pages only report what really happened (`/auth/verify-email-change`)
 * or offer what can still work (`/auth/reset-password`).
 */

export type EmailChangeOutcome = "updated" | "pending" | "invalid";

/**
 * Better Auth verifies the token, then redirects to the callback page —
 * with `error` on failure. The email form puts the new address in the
 * callback (`email`), so the page reports "updated" only when the
 * session carries it. The first step of the two-step change (a
 * confirmation, then a verification mail to the new address) lands here
 * too: "pending". A link without that proof, or an error, is "invalid".
 */
export function emailChangeOutcome(input: {
	error?: string | null;
	expectedEmail?: string | null;
	currentEmail?: string | null;
}): EmailChangeOutcome {
	const { error, expectedEmail, currentEmail } = input;
	if (error || !expectedEmail || !currentEmail) return "invalid";
	return expectedEmail.toLowerCase() === currentEmail.toLowerCase()
		? "updated"
		: "pending";
}

/**
 * Whether the reset form can still work: a token is present, Better Auth
 * did not redirect with an `error`, and `tokenIsValid` (Better Auth's own
 * token check) accepts it.
 */
export async function resetLinkIsUsable(
	input: { token?: string | null; error?: string | null },
	tokenIsValid: (token: string) => Promise<boolean>,
): Promise<boolean> {
	if (input.error || !input.token) return false;
	return tokenIsValid(input.token);
}

export type EmailVerificationFailure = "sign-in" | "other-account" | "failed";

/**
 * `/auth/verify`: the sign-up link counts only for a session of the same
 * user (`@fuutu/auth` hooks/email-verification-session.ts) — a signed-out
 * visitor signs in first, another account's session is refused.
 */
export function emailVerificationFailure(
	code: string | undefined,
): EmailVerificationFailure {
	if (code === "SIGN_IN_TO_VERIFY_EMAIL") return "sign-in";
	if (code === "EMAIL_VERIFICATION_OTHER_ACCOUNT") return "other-account";
	return "failed";
}

/** Sign-in that returns to `/auth/verify` with the token and landing page. */
export function emailVerificationSignInHref(
	token: string,
	callbackURL: string | null,
): string {
	const verify = new URLSearchParams({ token });
	if (callbackURL) verify.set("callbackURL", callbackURL);
	const redirect = `/auth/verify?${verify.toString()}`;
	return `/auth/sign-in?redirect=${encodeURIComponent(redirect)}`;
}
