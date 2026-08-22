import { auth } from "@fuutu/auth";
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

export type OrgMember = {
	id?: string;
	userId: string;
	role: string;
	email?: string;
};

export type FullOrganization = NonNullable<
	Awaited<ReturnType<typeof auth.api.getFullOrganization>>
>;

export async function requireOrgRole(
	organizationId: string,
	userId: string,
	minRole: OrgRole,
	headers?: Headers,
): Promise<FullOrganization> {
	const org = await auth.api.getFullOrganization({
		query: { organizationId },
		headers: headers ?? new Headers(),
	});
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
	headers?: Headers,
): Promise<FullOrganization> {
	const org = await auth.api.getFullOrganization({
		query: { organizationId },
		headers: headers ?? new Headers(),
	});
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
