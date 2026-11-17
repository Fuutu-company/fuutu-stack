/**
 * Better Auth's `/organization/get-full-organization` returns every pending
 * invitation (invitee emails) to any member. `hooks.after` filter: only
 * members whose org role may invite (`PERMISSIONS.INVITE_MEMBER`) see
 * them; everyone else gets an empty list. Also covers server-side
 * `auth.api.getFullOrganization` calls (the oRPC `organizations.get`).
 */
import {
	hasOrgPermission,
	ORG_POLICY,
	OrgAccessControl,
	PERMISSIONS,
	toOrgRole,
} from "@fuutu/rbac";

const FULL_ORGANIZATION_PATH = "/organization/get-full-organization";

const orgAC = new OrgAccessControl(ORG_POLICY);

type Member = { userId?: unknown; role?: unknown };

/**
 * The organization with `invitations: []` when `userId` may not invite,
 * or null when the result stands unchanged.
 */
export function hideInvitationsFromNonInviters(input: {
	path: string | undefined;
	returned: unknown;
	userId: string | undefined;
}): Record<string, unknown> | null {
	if (input.path !== FULL_ORGANIZATION_PATH) return null;
	const org = input.returned;
	if (!org || typeof org !== "object" || !("invitations" in org)) return null;
	const members =
		"members" in org && Array.isArray(org.members) ? org.members : [];
	const member = (members as Member[]).find((m) => m.userId === input.userId);
	const role = typeof member?.role === "string" ? member.role : null;
	if (
		member &&
		hasOrgPermission(orgAC, toOrgRole(role), PERMISSIONS.INVITE_MEMBER)
	) {
		return null;
	}
	return { ...org, invitations: [] };
}
