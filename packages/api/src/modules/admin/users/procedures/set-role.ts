import { auth } from "@fuutu/auth";
import { adminSetSystemRole, deleteSessionsImpersonatedBy } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../../orpc/middleware/rate-limit";
import { systemAdminProcedure } from "../../../../orpc/procedures";
import {
	type AdminAuditEntry,
	recordAdminAction,
	runAuditedAdminAction,
} from "../../audit";
import {
	adminIdSchema,
	assertNotSelf,
	loadTargetUser,
	reasonSchema,
	withAuthErrors,
} from "../../shared";

const setRoleInput = z.object({
	userId: adminIdSchema,
	role: z.enum(["admin", "user"]),
	reason: reasonSchema,
});

export const setUserRoleProcedure = systemAdminProcedure(
	PERMISSIONS.USER.UPDATE,
)
	.use(createRateLimitMiddleware({ endpoint: "adminMutation" }))
	.route({
		method: "POST",
		path: "/admin/users/{userId}/role",
		tags: ["Admin"],
		summary: "Set system role",
		description:
			"Makes a user a system admin or demotes an admin to user (their sessions and running impersonations end). Not your own role; the last admin stays. System admin only.",
	})
	.input(setRoleInput)
	.handler(async ({ input, context }) => {
		assertNotSelf(
			context.user.id,
			input.userId,
			"You cannot change your own role",
		);
		const target = await loadTargetUser(input.userId);
		// Decided before the write: an unchanged role is not audited.
		const changes = target.isAdmin !== (input.role === "admin");
		const setRole = async () => {
			// Last-admin check and role write share one Serializable transaction.
			const result = await adminSetSystemRole({
				userId: target.id,
				role: input.role,
			});
			if (result.status === "not_found") {
				throw new ORPCError("NOT_FOUND", { message: "User not found" });
			}
			if (result.status === "last_admin") {
				throw new ORPCError("CONFLICT", {
					message: "The last admin cannot be demoted",
				});
			}
			return result;
		};
		const audited: AdminAuditEntry = {
			action: "admin.user.set_role",
			targetUserId: target.id,
			reason: input.reason,
			changedFields: ["role"],
		};
		const result = changes
			? await runAuditedAdminAction(context, audited, setRole)
			: await setRole();
		if (!changes && result.status === "updated") {
			// The role changed between the read and the write: audited late,
			// never not at all.
			await recordAdminAction(context, audited);
		}
		// Also on an unchanged demotion: idempotent, and a retry after a
		// failed revoke must still end the sessions.
		if (input.role === "user") {
			await withAuthErrors(() =>
				auth.api.revokeUserSessions({
					body: { userId: target.id },
					headers: context.headers,
				}),
			);
			await deleteSessionsImpersonatedBy(target.id);
		}
		return { success: true, changed: result.status !== "unchanged" };
	});
