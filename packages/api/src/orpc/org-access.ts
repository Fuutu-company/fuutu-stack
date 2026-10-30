import {
	hasOrgPermission,
	type KnownPermission,
	ORG_POLICY,
	OrgAccessControl,
	toOrgRole,
} from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import {
	assertApiKeyOrgScope,
	type FullOrganization,
	getOrgOrNull,
	type OrgMember,
	resolveOrgForAccess,
} from "./middleware/authorize";

export { type FullOrganization, getOrgOrNull, type OrgMember };

// Org AC — checks the user's ORG role (Better-Auth organization plugin: "owner"/"admin"/"member")
const orgAC = new OrgAccessControl(ORG_POLICY);

/**
 * Org-access context — pass `context` (or `{ headers, apiKey }`) so the
 * helpers can resolve orgs via DB for API-key requests and enforce
 * org-scoped key pinning.
 */
export type OrgAccessContext = {
	headers?: Headers;
	apiKey?: { organizationId: string | null } | null;
};

export function requireOrgPermission(
	member: { role: string | null | undefined },
	permission: KnownPermission,
): void {
	const role = toOrgRole(member.role);
	if (!hasOrgPermission(orgAC, role, permission)) {
		throw new ORPCError("FORBIDDEN", { message: "Insufficient permissions" });
	}
}

export async function requireOrgPermissionAccess(
	organizationId: string,
	userId: string,
	permission: KnownPermission,
	access?: OrgAccessContext,
): Promise<FullOrganization> {
	assertApiKeyOrgScope(access?.apiKey ?? null, organizationId);
	const org = await resolveOrgForAccess(
		organizationId,
		access?.headers,
		access?.apiKey ?? null,
	);
	if (!org) {
		throw new ORPCError("NOT_FOUND", { message: "Organization not found" });
	}
	const member = org.members?.find((m: OrgMember) => m.userId === userId);
	if (!member) {
		throw new ORPCError("FORBIDDEN", { message: "Not a member" });
	}
	requireOrgPermission(member, permission);
	return org;
}
