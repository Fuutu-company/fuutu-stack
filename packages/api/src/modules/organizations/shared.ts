import {
	hasOrgPermission,
	hasRoleAtLeast,
	type KnownPermission,
	ORG_POLICY,
	OrgAccessControl,
	type OrgRole,
	toOrgRole,
} from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

// Org AC — checks the user's ORG role (Better-Auth organization plugin: "owner"/"admin"/"member")
const orgAC = new OrgAccessControl(ORG_POLICY);

export const slugSchema = z
	.string()
	.min(2)
	.max(64)
	.regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Invalid slug format");

import {
	assertApiKeyOrgScope,
	type FullOrganization,
	getOrgOrNull,
	type OrgMember,
	resolveOrgForAccess,
} from "../../orpc/middleware/authorize";

export { type FullOrganization, getOrgOrNull, type OrgMember };

/**
 * Org-access context — pass `context` (or `{ headers, apiKey }`) so the
 * helpers can resolve orgs via DB for API-key requests and enforce
 * org-scoped key pinning.
 */
export type OrgAccessContext = {
	headers?: Headers;
	apiKey?: { organizationId: string | null } | null;
};

export async function requireOrgRole(
	organizationId: string,
	userId: string,
	minRole: OrgRole,
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
	if (!hasRoleAtLeast(toOrgRole(member.role), minRole)) {
		throw new ORPCError("FORBIDDEN", {
			message: `${minRole} role required`,
		});
	}
	return org;
}

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
