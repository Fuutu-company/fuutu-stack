import type { UserWithRole } from "@fuutu/auth/types";
import { config } from "@fuutu/config";
import { listMembershipsForUser } from "@fuutu/db";
import {
	hasOrgPermission,
	ORG_POLICY,
	OrgAccessControl,
	PERMISSIONS,
	toOrgRole,
	toSystemRole,
} from "@fuutu/rbac";
import { requireAuth } from "@/lib/auth-server";
import { ApiKeyList } from "@/modules/app/api-keys/components/api-key-list";

const orgAC = new OrgAccessControl(ORG_POLICY);

export default async function UserApiKeysPage() {
	const session = await requireAuth();
	// Org picker: the user's orgs where their role may create API keys.
	// UI convenience only — apiKeys.create re-checks membership + permission.
	const memberships =
		config.features.organizationsMode === "off"
			? []
			: await listMembershipsForUser(session.user.id);
	const orgs = memberships
		.filter((m) =>
			hasOrgPermission(orgAC, toOrgRole(m.role), PERMISSIONS.API_KEY.CREATE),
		)
		.map(({ id, name }) => ({ id, name }));
	const isSystemAdmin =
		toSystemRole((session.user as UserWithRole).role) === "admin";

	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<ApiKeyList orgs={orgs} isSystemAdmin={isSystemAdmin} />
		</div>
	);
}
