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
import { type AuthorizeOptions, runAuthorize } from "./middleware/authorize";

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
 *
 * @deprecated Prefer `authProcedure({ systemPermission })` for new code.
 * Kept for backward compatibility — all existing procedures still work.
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

/**
 * Unified procedure builder — the preferred way to declare protected procedures.
 *
 * Combines auth, system permission, org membership/permission, plan tier,
 * active subscription, and limit enforcement in a single declarative config.
 *
 * The middleware determines the **scope** from the input:
 *   - `organizationId` present → org-scoped → org permission is checked (system skipped)
 *   - `organizationId` absent   → user-scoped → system permission is checked (org skipped if optional)
 *
 * For dual-scoped resources (api-keys, crm, storage), set BOTH `systemPermission`
 * and `org: { ..., optional: true }`. The same procedure then handles personal
 * and org actions — the input determines which permission is authoritative.
 *
 * The middleware attaches resolved data to context:
 * `user`, `systemRole`, `org`, `orgRole`, `membership`, `planId`, `planTier`.
 *
 * @example
 * // Auth only
 * export const getProfile = authProcedure()
 *   .handler(...)
 *
 * // System permission only (user-scoped resource — notifications, credits)
 * export const listNotifications = authProcedure({ systemPermission: PERMISSIONS.NOTIFICATION.VIEW })
 *   .handler(...)
 *
 * // Org permission only (org-scoped resource — webhooks, org-delete)
 * export const deleteOrg = authProcedure({ org: { permission: PERMISSIONS.ORGANIZATION.DELETE } })
 *   .handler(...)
 *
 * // Dual-scoped (personal + org — api-keys, crm, storage)
 * // orgId present → org check; orgId absent → system check
 * export const createApiKey = authProcedure({
 *   systemPermission: PERMISSIONS.API_KEY.CREATE,
 *   org: { permission: PERMISSIONS.API_KEY.CREATE, optional: true },
 *   limit: { key: "apiKeys", count: async (ctx) => ctx.org ? countOrgApiKeys(ctx.org.id) : countApiKeys(ctx.user.id) },
 * })
 *   .handler(...)
 *
 * // Org + plan + limit (feature-gated org resource)
 * export const createWebhook = authProcedure({
 *   org: { permission: PERMISSIONS.WEBHOOK.CREATE },
 *   plan: "pro",
 *   limit: { key: "webhooks", count: async (ctx) => countWebhooks(ctx.org?.id ?? "") },
 * })
 *   .handler(...)
 */
export function authProcedure(options: AuthorizeOptions = {}) {
	return publicProcedure.use(async ({ context, next }, input) => {
		const authCtx = await runAuthorize(options, context, input);
		return next({ context: authCtx });
	});
}
