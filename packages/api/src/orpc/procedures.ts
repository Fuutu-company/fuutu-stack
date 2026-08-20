import type { UserWithRole } from "@fuutu/auth/types";
import {
	AccessControl,
	DEFAULT_ACCESS_POLICY,
	hasPermission,
	PERMISSIONS,
	toRbacRole,
} from "@fuutu/rbac";
import { ORPCError, os } from "@orpc/server";
import type { Context } from "../context";

const ac = new AccessControl(DEFAULT_ACCESS_POLICY);

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
 * Requires authenticated user with VIEW_ADMIN permission.
 */
export const adminProcedure = permissionProcedure(PERMISSIONS.VIEW_ADMIN);

/**
 * Procedure that requires a specific permission.
 * Checks the user's role against DEFAULT_ACCESS_POLICY via AccessControl.
 */
export function permissionProcedure(permission: string) {
	return protectedProcedure.use(async ({ context, next }) => {
		const role = toRbacRole(context.user.role);
		if (!hasPermission(ac, role, permission)) {
			throw new ORPCError("FORBIDDEN", {
				message: "Insufficient permissions",
			});
		}
		return next({ context: { user: context.user, role } });
	});
}
