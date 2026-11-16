/**
 * An organization always keeps an owner. Better Auth checks the owner
 * count only for self-demotion and owner removal, and each request
 * checks before it writes — two owners demoting each other at once both
 * pass and leave none. `organizationHooks` wiring:
 *   - `beforeUpdateMemberRole` / `beforeRemoveMember`: refuse a change
 *     that leaves no owner (whoever makes it);
 *   - `afterUpdateMemberRole`: if concurrent demotions still left no
 *     owner, the demoted member is made owner again and the change fails.
 */
import {
	adminSetOrganizationMemberRole,
	countOrganizationOwners,
} from "@fuutu/db";
import { APIError } from "better-auth/api";

const OWNER = "owner";

type MemberRef = { id: string; organizationId: string; role: string };

const hasOwnerRole = (role: string | string[]) =>
	[role]
		.flat()
		.flatMap((r) => r.split(","))
		.some((r) => r.trim() === OWNER);

function noOwnerLeft(): APIError {
	return new APIError("BAD_REQUEST", {
		message: "An organization needs at least one owner",
		code: "YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER",
	});
}

/** The member is an owner and the only one. */
async function isLastOwner(member: MemberRef): Promise<boolean> {
	if (!hasOwnerRole(member.role)) return false;
	return (await countOrganizationOwners(member.organizationId)) <= 1;
}

export async function assertOwnerRemainsAfterRoleChange(input: {
	member: MemberRef;
	newRole: string | string[];
}): Promise<void> {
	if (hasOwnerRole(input.newRole)) return;
	if (await isLastOwner(input.member)) throw noOwnerLeft();
}

export async function assertOwnerRemainsAfterRemoval(input: {
	member: MemberRef;
}): Promise<void> {
	if (await isLastOwner(input.member)) throw noOwnerLeft();
}

export async function restoreOwnerIfNoneLeft(input: {
	member: MemberRef;
	previousRole: string;
}): Promise<void> {
	if (!hasOwnerRole(input.previousRole) || hasOwnerRole(input.member.role)) {
		return;
	}
	if ((await countOrganizationOwners(input.member.organizationId)) > 0) return;
	await adminSetOrganizationMemberRole({
		organizationId: input.member.organizationId,
		memberId: input.member.id,
		role: OWNER,
	});
	throw noOwnerLeft();
}
