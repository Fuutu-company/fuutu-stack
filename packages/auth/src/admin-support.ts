/**
 * Support (system admin) actions on organizations — server-only.
 *
 * Better Auth's organization endpoints require the caller to be a member,
 * and support is not. These functions write through the `@fuutu/db`
 * admin queries and run the same side effects the org plugin's
 * `organizationHooks` (index.ts) run for the change, so a support action
 * leaves the organization exactly as a member action would. Permission
 * checks and audit logging belong to the caller (`admin.organizations.*`).
 */
import { config } from "@fuutu/config";
import {
	type AdminRemoveMemberResult,
	type AdminSetMemberRoleResult,
	type AdminTransferOwnershipResult,
	adminDeleteOrganization,
	adminExtendOrganizationInvitation,
	adminGetOrganizationInvitation,
	adminRemoveOrganizationMember,
	adminSetOrganizationMemberRole,
	adminTransferOrganizationOwnership,
	countOrganizationOwners,
	getOrganizationMemberForAdmin,
	type OrgMemberRole,
} from "@fuutu/db";
import { toOrgRole } from "@fuutu/rbac";
import { authConfig } from "./config";
import { revokeApiKeysOfRemovedMember } from "./hooks/member-api-keys";
import {
	cancelActiveSubscriptionsForOrganization,
	syncSeatsForOrganization,
} from "./hooks/payments-sync";
import { assertInviteSeatAvailable } from "./hooks/seat-limit";
import { sendOrganizationInvitationEmail } from "./lib/invitation-email";

type MemberRef = { organizationId: string; memberId: string };

/**
 * Removes a member: their org API keys are revoked first (fail closed,
 * as `beforeRemoveMember`), seats are synced afterwards
 * (`afterRemoveMember`). The last owner is never removed.
 */
export async function supportRemoveMember(
	input: MemberRef,
): Promise<AdminRemoveMemberResult> {
	const member = await getOrganizationMemberForAdmin(
		input.organizationId,
		input.memberId,
	);
	if (!member) return { status: "not_found" };
	// Checked before the keys go; the delete re-checks in its transaction.
	if (
		toOrgRole(member.role) === "owner" &&
		(await countOrganizationOwners(input.organizationId)) <= 1
	) {
		return { status: "last_owner" };
	}
	await revokeApiKeysOfRemovedMember(member);
	const result = await adminRemoveOrganizationMember(input);
	if (result.status === "removed") {
		await syncSeatsForOrganization(input.organizationId);
	}
	return result;
}

/** Changes a member's role; the organization keeps at least one owner. */
export function supportSetMemberRole(
	input: MemberRef & { role: OrgMemberRole },
): Promise<AdminSetMemberRoleResult> {
	return adminSetOrganizationMemberRole(input);
}

/**
 * Makes the member the owner; every other owner becomes admin — one
 * transaction.
 */
export function supportTransferOwnership(
	input: MemberRef,
): Promise<AdminTransferOwnershipResult> {
	return adminTransferOrganizationOwnership(input);
}

/**
 * Deletes the organization after cancelling its subscriptions
 * (`beforeDeleteOrganization`). False when it no longer existed.
 */
export async function supportDeleteOrganization(
	organizationId: string,
): Promise<boolean> {
	await cancelActiveSubscriptionsForOrganization(organizationId);
	return (await adminDeleteOrganization(organizationId)) > 0;
}

export type SupportResendInvitationResult =
	| { status: "not_found" }
	| { status: "not_pending" }
	| {
			status: "resent";
			/** False when the mail provider failed — the new expiry still holds. */
			emailSent: boolean;
			invitation: {
				id: string;
				email: string;
				role: string | null;
				status: string;
				expiresAt: Date;
			};
	  };

/**
 * Resends a pending invitation like Better Auth's `resend`: validity
 * restarts at `authConfig.organizations.invitationExpiresIn`, and the
 * same invitation email goes out — in the original inviter's name (the
 * app name when it has none), never the support admin's. Reviving an
 * expired invitation reserves a seat again, so the seat cap is checked
 * (throws the seat-limit `APIError`, as `beforeCreateInvitation`).
 */
export async function supportResendInvitation(input: {
	organizationId: string;
	invitationId: string;
	now?: Date;
}): Promise<SupportResendInvitationResult> {
	const now = input.now ?? new Date();
	const invitation = await adminGetOrganizationInvitation(
		input.organizationId,
		input.invitationId,
	);
	if (!invitation) return { status: "not_found" };
	if (invitation.status !== "pending") return { status: "not_pending" };
	if (invitation.expiresAt <= now) {
		await assertInviteSeatAvailable(input.organizationId);
	}

	const expiresAt = new Date(
		now.getTime() + authConfig.organizations.invitationExpiresIn * 1000,
	);
	const updated = await adminExtendOrganizationInvitation({
		organizationId: input.organizationId,
		invitationId: invitation.id,
		expiresAt,
	});
	if (updated === 0) return { status: "not_pending" };

	const emailSent = await sendOrganizationInvitationEmail({
		email: invitation.email,
		invitationId: invitation.id,
		organizationName: invitation.organization.name,
		inviterName: invitation.inviter.name || config.app.name,
		locale: invitation.inviter.locale ?? undefined,
	});
	return {
		status: "resent",
		emailSent,
		invitation: {
			id: invitation.id,
			email: invitation.email,
			role: invitation.role,
			status: invitation.status,
			expiresAt,
		},
	};
}
