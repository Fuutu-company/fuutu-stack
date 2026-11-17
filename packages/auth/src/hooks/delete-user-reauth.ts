/**
 * Better Auth deletes the account on `/delete-user` without a password
 * while the session is younger than its `freshAge` (one day) — a stolen
 * cookie would be enough. `hooks.before` guard: an account with a password
 * must send it (Better Auth verifies it); a passwordless account (social,
 * magic link, passkey) needs a session signed in within
 * `authConfig.session.freshSessionMaxAge`.
 */
import { APIError } from "better-auth/api";
import { assertSessionSignedInRecently } from "./fresh-session";

export async function assertDeleteUserReauth(input: {
	path: string | undefined;
	body: unknown;
	getSession: () => Promise<{
		user: { id: string };
		session: { createdAt: Date | string };
	} | null>;
	/** Whether the user has a credential (password) account. */
	hasPassword: (userId: string) => Promise<boolean>;
	maxAgeSeconds?: number;
	now?: number;
}): Promise<void> {
	if (input.path !== "/delete-user") return;
	const body = (input.body ?? {}) as { password?: unknown; token?: unknown };
	// A deletion token (`sendDeleteAccountVerification`) proves the mailbox;
	// Better Auth checks it.
	if (typeof body.token === "string" && body.token) return;
	const session = await input.getSession();
	if (!session) return;
	if (await input.hasPassword(session.user.id)) {
		if (typeof body.password === "string" && body.password) return;
		throw new APIError("BAD_REQUEST", {
			message: "Enter your password to delete the account",
			code: "PASSWORD_REQUIRED",
		});
	}
	assertSessionSignedInRecently(session.session.createdAt, input);
}
