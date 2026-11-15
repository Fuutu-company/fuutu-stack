import { auth } from "@fuutu/auth";
import { countAdminUsers } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../../orpc/middleware/rate-limit";
import { systemAdminProcedure } from "../../../../orpc/procedures";
import { recordAdminAction } from "../../audit";
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
			"Makes a user a system admin or demotes an admin to user (their sessions end). Not your own role; the last admin stays. System admin only.",
	})
	.input(setRoleInput)
	.handler(async ({ input, context }) => {
		assertNotSelf(
			context.user.id,
			input.userId,
			"You cannot change your own role",
		);
		const target = await loadTargetUser(input.userId);
		const demote = target.isAdmin && input.role === "user";
		if (target.isAdmin === (input.role === "admin")) {
			return { success: true, changed: false };
		}
		if (demote && (await countAdminUsers()) <= 1) {
			throw new ORPCError("CONFLICT", {
				message: "The last admin cannot be demoted",
			});
		}

		await withAuthErrors(() =>
			auth.api.setRole({
				body: { userId: target.id, role: input.role },
				headers: context.headers,
			}),
		);
		if (demote) {
			await withAuthErrors(() =>
				auth.api.revokeUserSessions({
					body: { userId: target.id },
					headers: context.headers,
				}),
			);
		}

		await recordAdminAction(context, {
			action: "admin.user.set_role",
			targetUserId: target.id,
			reason: input.reason,
			changedFields: ["role"],
		});
		return { success: true, changed: true };
	});
