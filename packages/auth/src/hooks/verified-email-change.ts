/**
 * Better Auth sends the email-change confirmation to the CURRENT address
 * only when it is verified; for an unverified account the link goes
 * straight to the new address — whoever holds the session could move the
 * account to their own mailbox. `hooks.before` guard: verify the current
 * email first.
 */
import { APIError } from "better-auth/api";

type SessionLookup = () => Promise<{
	user: { emailVerified?: boolean | null };
} | null>;

/** Throws `APIError("FORBIDDEN")` (code `EMAIL_NOT_VERIFIED`). */
export async function assertVerifiedEmailForChange(input: {
	path: string | undefined;
	getSession: SessionLookup;
}): Promise<void> {
	if (input.path !== "/change-email") return;
	const session = await input.getSession();
	if (!session || session.user.emailVerified === true) return;
	throw new APIError("FORBIDDEN", {
		message: "Verify your current email address first",
		code: "EMAIL_NOT_VERIFIED",
	});
}
