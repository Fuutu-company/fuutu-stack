import type { UserWithRole } from "@fuutu/auth/types";
import {
	hasSystemPermission,
	type KnownPermission,
	PERMISSIONS,
	SYSTEM_POLICY,
	SystemAccessControl,
	toSystemRole,
} from "@fuutu/rbac";

export { PERMISSIONS } from "@fuutu/rbac";

import { ORPCError, os } from "@orpc/server";
import type { Context } from "../context";

// System AC — checks the user's SYSTEM role (Better-Auth admin plugin: "admin"/"user")
const systemAC = new SystemAccessControl(SYSTEM_POLICY);

export const publicProcedure = os.$context<Context>();

export const protectedProcedure = publicProcedure.use(
	async ({ context, next }) => {
		if (!context.session?.user) {
			throw new ORPCError("UNAUTHORIZED");
		}

		return next({
			context: {
				user: context.session.user as UserWithRole,
			},
		});
	},
);

/**
 * Admin-only procedure
 * Requires authenticated user with VIEW_ADMIN permission (system-level).
 */
export const adminProcedure = permissionProcedure(PERMISSIONS.VIEW_ADMIN);

/**
 * Procedure that requires a specific SYSTEM permission.
 * Checks the user's SYSTEM role (context.user.role) against SYSTEM_POLICY.
 *
 * This checks "is this user a system admin?" — NOT "is this user admin in org X?".
 * For org-scoped checks, use requireOrgPermissionAccess() in the handler.
 */
export function permissionProcedure(permission: KnownPermission) {
	return protectedProcedure.use(async ({ context, next }) => {
		const role = toSystemRole(context.user.role);
		if (!hasSystemPermission(systemAC, role, permission)) {
			throw new ORPCError("FORBIDDEN", {
				message: "Insufficient permissions",
			});
		}
		return next({ context: { user: context.user, role } });
	});
}
