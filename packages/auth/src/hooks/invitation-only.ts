/**
 * Invitation-only sign-up gate.
 *
 * When `authConfig.signup.invitationOnly` is true, new users may only sign up
 * if there is a matching pending `Invitation` row for their email address.
 *
 * `/sign-up/email` additionally requires `invitationId` in the request body
 * (the record schema allows unknown keys, so it reaches this hook via
 * `ctx.body`) — it must reference a pending invitation whose email matches,
 * which binds the sign-up to the exact invite token and prevents an invited
 * mailbox from being used to squat a different account.
 * `/magic-link/verify` and `/callback/*` keep the plain existence check:
 * those paths already prove mailbox/identity ownership.
 *
 * Implemented as a `databaseHooks.user.create.before` guard that throws a
 * Better-Auth `APIError` to short-circuit the sign-up endpoint.
 */
import { findPendingInvitation, findPendingInvitationById } from "@fuutu/db";
import { APIError } from "better-auth/api";
import { authConfig } from "../config";
import { isSelfServiceSignupPath } from "./signup-policy";

interface SignupContext {
	path?: string;
	body?: Record<string, unknown>;
}

export async function assertInvitationForSignup(
	user: { email?: string | null },
	context?: SignupContext | null,
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

	if (context?.path === "/sign-up/email") {
		const invitationId = context.body?.invitationId;
		const invite =
			typeof invitationId === "string" && invitationId.length > 0
				? await findPendingInvitationById(invitationId, email)
				: null;
		if (!invite) {
			throw new APIError("FORBIDDEN", {
				message:
					"Sign-up is invitation-only. Use the link from your invite email.",
			});
		}
		return;
	}

	const invite = await findPendingInvitation(email);

	if (!invite) {
		throw new APIError("FORBIDDEN", {
			message: "Sign-up is invitation-only. Please request an invite.",
		});
	}
}
