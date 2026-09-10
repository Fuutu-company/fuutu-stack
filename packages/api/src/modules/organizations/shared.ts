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

/**
 * Safely fetch an organization, returning `null` when it doesn't exist.
 *
 * Better-Auth's `getFullOrganization` throws an `APIError` with
 * `code: "ORGANIZATION_NOT_FOUND"` (HTTP 400) instead of returning null.
 * This helper normalizes that to `null` so callers can use a simple
 * null-check and throw a clean `ORPCError("NOT_FOUND")`.
 */
export async function getOrgOrNull(
	organizationId: string,
	headers?: Headers,
): Promise<FullOrganization | null> {
	try {
		const org = await auth.api.getFullOrganization({
			query: { organizationId },
			headers: headers ?? new Headers(),
		});
		return org;
	} catch (e) {
		// Better-Auth APIError: { name: "APIError", statusCode: 400, body.code: "ORGANIZATION_NOT_FOUND" }
		if (
			e instanceof Error &&
			e.name === "APIError" &&
			"statusCode" in e &&
			(e as { statusCode: number }).statusCode === 400
		) {
			return null;
		}
		throw e;
	}
}

export async function requireOrgRole(
	organizationId: string,
	userId: string,
	minRole: OrgRole,
	headers?: Headers,
): Promise<FullOrganization> {
	const org = await getOrgOrNull(organizationId, headers);
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
	const org = await getOrgOrNull(organizationId, headers);
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
