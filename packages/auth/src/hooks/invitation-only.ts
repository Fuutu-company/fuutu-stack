/**
 * Invitation-only sign-up gate.
 *
 * When `authConfig.signup.invitationOnly` is true, new users may only sign up
 * if there is a matching pending `Invitation` row for their email address.
 *
 * Implemented as a `databaseHooks.user.create.before` guard that throws a
 * Better-Auth `APIError` to short-circuit the sign-up endpoint.
 */
import { findPendingInvitation } from "@fuutu/db";
import { APIError } from "better-auth/api";
import { authConfig } from "../config";
import { isSelfServiceSignupPath } from "./signup-policy";

export async function assertInvitationForSignup(
	user: { email?: string | null },
	context?: { path?: string } | null,
	invitationOnly: boolean = authConfig.signup.invitationOnly,
): Promise<void> {
	if (!invitationOnly) return;

	// Same scoping as the sign-up gate: only self-service paths are gated.
	// Admin provisioning (`/admin/create-user`) and context-free creations
	// (seed/CLI scripts) must not require an invitation row.
	if (!isSelfServiceSignupPath(context?.path)) return;

	const email = user.email?.toLowerCase();
	if (!email) {
		throw new APIError("BAD_REQUEST", {
			message: "Email is required for invitation-only signup.",
		});
	}

	const invite = await findPendingInvitation(email);

	if (!invite) {
		throw new APIError("FORBIDDEN", {
			message: "Sign-up is invitation-only. Please request an invite.",
		});
	}
}
