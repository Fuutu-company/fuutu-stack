/**
 * Invitation-only sign-up gate.
 *
 * When `authConfig.signup.invitationOnly` is true, new users may only sign up
 * if there is a matching pending `Invitation` row for their email address.
 *
 * Implemented as a `databaseHooks.user.create.before` guard that throws a
 * Better-Auth `APIError` to short-circuit the sign-up endpoint.
 */
import { db } from "@fuutu/db";
import { APIError } from "better-auth/api";
import { authConfig } from "../config";

export async function assertInvitationForSignup(user: {
	email?: string | null;
}): Promise<void> {
	if (!authConfig.signup.invitationOnly) return;

	const email = user.email?.toLowerCase();
	if (!email) {
		throw new APIError("BAD_REQUEST", {
			message: "Email is required for invitation-only signup.",
		});
	}

	const invite = await db.invitation.findFirst({
		where: {
			email,
			status: "pending",
			expiresAt: { gt: new Date() },
		},
		select: { id: true },
	});

	if (!invite) {
		throw new APIError("FORBIDDEN", {
			message: "Sign-up is invitation-only. Please request an invite.",
		});
	}
}
