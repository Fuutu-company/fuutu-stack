/**
 * Better Auth's two-factor plugin only challenges password sign-ins
 * (`/sign-in/email|username|phone-number`). A magic link, an email or
 * phone OTP, a wallet or a social sign-in would sign a 2FA user in with
 * the mailbox, the phone or the provider account alone. This `databaseHooks.session.create.before` guard refuses
 * the session before it exists — no row, no cookie — and sends the user
 * to the error page; they sign in with password + code instead (enabling
 * 2FA requires a password). A passkey sign-in stays allowed: it is a
 * second-factor-equivalent credential bound to the device.
 */
import { APIError } from "better-auth/api";

/** Error code shown on the auth error page. */
export const TWO_FACTOR_REQUIRED = "TWO_FACTOR_REQUIRED";

// Every Better Auth endpoint that can mint a session is classified in
// __tests__/second-factor-coverage.test.ts — plugins the kit leaves off
// (oneTap, emailOTP, genericOAuth, siwe, phoneNumber, oauthProxy) are
// listed here too, so adding one never skips 2FA.

/** Browser redirects (GET) — answered with a redirect to the error page. */
const REDIRECT_PATHS: ReadonlySet<string> = new Set([
	"/magic-link/verify",
	"/callback/:id",
	"/callback/:id/oauth-proxy",
	"/oauth2/callback/:providerId",
]);

/** `fetch` calls (POST, e.g. Google id token) — answered with a 403. */
const JSON_PATHS: ReadonlySet<string> = new Set([
	"/sign-in/social",
	"/one-tap/callback",
	"/sign-in/email-otp",
	"/siwe/verify",
	"/phone-number/verify",
]);

/**
 * Throws when `path` would give `userId` (with 2FA on) a session without
 * the second factor.
 */
export async function assertSecondFactorForNewSession(input: {
	path: string | undefined;
	userId: string;
	findUser: (userId: string) => Promise<Record<string, unknown> | null>;
	errorPageUrl: () => string;
	redirect: (url: string) => Error;
}): Promise<void> {
	const { path } = input;
	if (!path || !(REDIRECT_PATHS.has(path) || JSON_PATHS.has(path))) return;
	const user = await input.findUser(input.userId);
	if (user?.twoFactorEnabled !== true) return;
	if (JSON_PATHS.has(path)) {
		throw new APIError("FORBIDDEN", {
			message: "Sign in with your password and authentication code",
			code: TWO_FACTOR_REQUIRED,
		});
	}
	const url = new URL(input.errorPageUrl());
	url.searchParams.set("error", TWO_FACTOR_REQUIRED);
	throw input.redirect(url.toString());
}

/**
 * `databaseHooks.account.create.before`: Better Auth links the provider
 * account (`handleOAuthUserInfo`) BEFORE the session is refused above, so
 * a refused social sign-in would still leave a mailbox holder's provider
 * account linked to the 2FA user — signing in with it once 2FA is off.
 * New links for a 2FA user only come from the authenticated `/link-social`
 * flow (`isLinkFlow`: the callback's OAuth state carries `link`).
 */
export async function assertSecondFactorForNewAccountLink(input: {
	path: string | undefined;
	userId: string;
	isLinkFlow: () => Promise<boolean>;
	findUser: (userId: string) => Promise<Record<string, unknown> | null>;
	errorPageUrl: () => string;
	redirect: (url: string) => Error;
}): Promise<void> {
	const { path } = input;
	if (!path || !(REDIRECT_PATHS.has(path) || JSON_PATHS.has(path))) return;
	if (await input.isLinkFlow()) return;
	await assertSecondFactorForNewSession(input);
}
