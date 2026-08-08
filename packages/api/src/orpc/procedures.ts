import type { UserWithRole } from "@fuutu/auth/types";
import { hasRoleAtLeast, toRbacRole } from "@fuutu/rbac";
import { ORPCError, os } from "@orpc/server";
import type { Context } from "../context";

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
 * Requires authenticated user with admin-level role (owner or admin) via toRbacRole normalization.
 */
export const adminProcedure = protectedProcedure.use(
	async ({ context, next }) => {
		const role = toRbacRole(context.user.role);
		if (!hasRoleAtLeast(role, "admin")) {
			throw new ORPCError("FORBIDDEN", {
				message: "Admin role required",
			});
		}

		return next({
			context: {
				user: context.user,
				role,
			},
		});
	},
);
