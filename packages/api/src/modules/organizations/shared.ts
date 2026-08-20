import { auth } from "@fuutu/auth";
import {
	AccessControl,
	DEFAULT_ACCESS_POLICY,
	hasPermission,
	hasRoleAtLeast,
	type Role,
	toRbacRole,
} from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

const ac = new AccessControl(DEFAULT_ACCESS_POLICY);

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
	minRole: Role,
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
	if (!hasRoleAtLeast(toRbacRole(member.role), minRole)) {
		throw new ORPCError("FORBIDDEN", {
			message: `${minRole} role required`,
		});
	}
	return org;
}

export function requireOrgPermission(
	member: { role: string | null | undefined },
	permission: string,
): void {
	const role = toRbacRole(member.role);
	if (!hasPermission(ac, role, permission)) {
		throw new ORPCError("FORBIDDEN", { message: "Insufficient permissions" });
	}
}

export async function requireOrgPermissionAccess(
	organizationId: string,
	userId: string,
	permission: string,
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
