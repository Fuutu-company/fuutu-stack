import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import {
	memberHasOrgPermission,
	type OrgAccessContext,
	type OrgMember,
	requireOrgPermissionAccess,
} from "../../orpc/org-access";

/**
 * Who may revoke or delete an org API key: an admin/owner
 * (`API_KEY.DELETE`) any key of the org, a member only the keys they
 * created (`ApiKey.userId`) while they may still create keys there.
 */
export function canManageOrgApiKey(
	member: Pick<OrgMember, "userId" | "role">,
	key: { userId: string },
): boolean {
	if (memberHasOrgPermission(member, PERMISSIONS.API_KEY.DELETE)) return true;
	return (
		key.userId === member.userId &&
		memberHasOrgPermission(member, PERMISSIONS.API_KEY.CREATE)
	);
}

/** Throws FORBIDDEN unless `userId` may revoke/delete the org `key`. */
export async function requireOrgApiKeyManageAccess(
	key: { organizationId: string; userId: string },
	userId: string,
	access: OrgAccessContext,
): Promise<void> {
	const org = await requireOrgPermissionAccess(
		key.organizationId,
		userId,
		PERMISSIONS.API_KEY.VIEW,
		access,
	);
	const member = org.members?.find((m: OrgMember) => m.userId === userId);
	if (!member || !canManageOrgApiKey(member, key)) {
		throw new ORPCError("FORBIDDEN", { message: "Insufficient permissions" });
	}
}
