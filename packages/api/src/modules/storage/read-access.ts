import { getOrganizationMemberRole } from "@fuutu/db";
import {
	hasSystemPermission,
	PERMISSIONS,
	SYSTEM_POLICY,
	SystemAccessControl,
	toSystemRole,
} from "@fuutu/rbac";
import {
	resolveBucketReadAccess,
	type StorageReadAccess,
} from "@fuutu/storage";
import { memberHasOrgPermission } from "../../orpc/org-access";

const systemAC = new SystemAccessControl(SYSTEM_POLICY);

/**
 * Per-object read authorization for `/image-proxy/<alias>/<key>`. Uploads
 * are keyed `<userId>/…` or `<orgId>/…` (storage procedures), so the first
 * key segment names the owner. An owner-only bucket's object is readable
 * by that user, by a member of that org with STORAGE.VIEW, or by a system
 * admin with ADMIN_ORGANIZATION.VIEW (support views of any org). A bucket
 * with `readAccess: "signed-in"` is readable by every signed-in user.
 */
export async function canReadStorageObject(input: {
	alias: string;
	key: string;
	user: { id: string; role?: string | null };
}): Promise<boolean> {
	let access: StorageReadAccess;
	try {
		access = resolveBucketReadAccess(input.alias);
	} catch {
		return false;
	}
	if (access === "signed-in") return true;

	const owner = input.key.split("/")[0];
	if (!owner) return false;
	if (owner === input.user.id) return true;

	const role = await getOrganizationMemberRole(owner, input.user.id);
	if (role && memberHasOrgPermission({ role }, PERMISSIONS.STORAGE.VIEW)) {
		return true;
	}
	return hasSystemPermission(
		systemAC,
		toSystemRole(input.user.role),
		PERMISSIONS.ADMIN_ORGANIZATION.VIEW,
	);
}
