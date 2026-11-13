import { findOrganizationMember } from "@fuutu/db";
import { ORPCError } from "@orpc/server";

export type OrgMemberRef = {
	id: string;
	userId: string;
	role: string;
	email?: string;
};

/**
 * Resolves the target of a member mutation by id, user id or email. The
 * org on the context comes from Better Auth's `getFullOrganization`, whose
 * member list is capped — a target beyond the cap is looked up in the DB
 * instead of being treated as a plain member (which would let an admin
 * demote or remove an owner of a large org).
 */
export async function findOrgMember(
	organizationId: string,
	loaded: OrgMemberRef[] | undefined,
	idOrEmail: string,
): Promise<OrgMemberRef> {
	const matches = (m: OrgMemberRef) =>
		m.id === idOrEmail || m.userId === idOrEmail || m.email === idOrEmail;
	const hit = loaded?.find(matches);
	if (hit) return hit;
	const row = await findOrganizationMember(organizationId, idOrEmail);
	if (!row) throw new ORPCError("NOT_FOUND", { message: "Member not found" });
	return row;
}
