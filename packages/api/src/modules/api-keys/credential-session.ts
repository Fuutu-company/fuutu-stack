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
