/**
 * Support impersonation lasts only while the impersonating admin may still
 * impersonate — shared by Better Auth's `hooks.before`, the API context and
 * the app's server guards. Server-only (reads the database).
 */
import { getUserAccessState } from "@fuutu/db";
import {
	hasSystemPermission,
	PERMISSIONS,
	SYSTEM_POLICY,
	SystemAccessControl,
	toSystemRole,
} from "@fuutu/rbac";
import type { ImpersonationSessionLike } from "./impersonation";
import { isBanActive } from "./types";

const systemAC = new SystemAccessControl(SYSTEM_POLICY);

/**
 * True when `session` is an impersonation whose admin was demoted, banned
 * or deleted — it ends at once, not when the cookie-cached session runs
 * out. Cost: one primary-key user read, impersonation sessions only.
 */
export async function hasImpersonatorLostAccess({
	impersonatedBy,
}: ImpersonationSessionLike): Promise<boolean> {
	if (!impersonatedBy) return false;
	const impersonator = await getUserAccessState(impersonatedBy);
	return (
		!impersonator ||
		isBanActive(impersonator) ||
		!hasSystemPermission(
			systemAC,
			toSystemRole(impersonator.role),
			PERMISSIONS.IMPERSONATE_USER,
		)
	);
}
