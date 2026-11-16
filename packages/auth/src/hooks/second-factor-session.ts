/**
 * Better Auth's two-factor plugin only challenges password sign-ins
 * (`/sign-in/email|username|phone-number`). A magic link or a social
 * sign-in would sign a 2FA user in with the mailbox or the provider
 * account alone. This `databaseHooks.session.create.before` guard refuses
 * the session before it exists — no row, no cookie — and sends the user
 * to the error page; they sign in with password + code instead (enabling
 * 2FA requires a password). A passkey sign-in stays allowed: it is a
 * second-factor-equivalent credential bound to the device.
 */
import { APIError } from "better-auth/api";

/** Error code shown on the auth error page. */
export const TWO_FACTOR_REQUIRED = "TWO_FACTOR_REQUIRED";

/** Browser redirects (GET) — answered with a redirect to the error page. */
const REDIRECT_PATHS: ReadonlySet<string> = new Set([
	"/magic-link/verify",
	"/callback/:id",
]);

/** `fetch` calls (POST, e.g. Google id token) — answered with a 403. */
const JSON_PATHS: ReadonlySet<string> = new Set(["/sign-in/social"]);

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
