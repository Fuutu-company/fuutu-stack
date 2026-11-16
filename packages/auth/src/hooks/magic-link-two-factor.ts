/**
 * Better Auth's two-factor plugin only challenges password sign-ins, so a
 * magic link would sign a 2FA user in with the mailbox alone. This
 * `hooks.after` guard ends the session `/magic-link/verify` just created
 * for a user with 2FA on and sends them to the error page — they sign in
 * with password + code instead (enabling 2FA requires a password).
 */

const MAGIC_LINK_VERIFY_PATH = "/magic-link/verify";

/** Error code shown on the auth error page. */
export const TWO_FACTOR_REQUIRED = "TWO_FACTOR_REQUIRED";

/**
 * Returns the error-page URL to redirect to after ending the new session,
 * or null when the sign-in may stand.
 */
export async function blockMagicLinkSecondFactorBypass(input: {
	path: string | undefined;
	newSession:
		| {
				session: { token: string };
				user: Record<string, unknown>;
		  }
		| null
		| undefined;
	/** Deletes the session row and clears its cookies. */
	endSession: (token: string) => Promise<void>;
	errorPageUrl: () => string;
}): Promise<string | null> {
	if (input.path !== MAGIC_LINK_VERIFY_PATH) return null;
	if (input.newSession?.user.twoFactorEnabled !== true) return null;
	await input.endSession(input.newSession.session.token);
	const url = new URL(input.errorPageUrl());
	url.searchParams.set("error", TWO_FACTOR_REQUIRED);
	return url.toString();
}
