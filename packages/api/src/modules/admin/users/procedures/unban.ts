import { auth } from "@fuutu/auth";
import { PERMISSIONS } from "@fuutu/rbac";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../../orpc/middleware/rate-limit";
import { systemAdminProcedure } from "../../../../orpc/procedures";
import { recordAdminAction } from "../../audit";
import {
	adminIdSchema,
	loadTargetUser,
	reasonSchema,
	withAuthErrors,
} from "../../shared";

export const unbanUserProcedure = systemAdminProcedure(PERMISSIONS.USER.UPDATE)
	.use(createRateLimitMiddleware({ endpoint: "adminMutation" }))
	.route({
		method: "POST",
		path: "/admin/users/{userId}/unban",
		tags: ["Admin"],
		summary: "Unban user",
		description: "Lifts a user's ban. System admin only.",
	})
	.input(z.object({ userId: adminIdSchema, reason: reasonSchema.optional() }))
	.handler(async ({ input, context }) => {
		const target = await loadTargetUser(input.userId);
		await withAuthErrors(() =>
			auth.api.unbanUser({
				body: { userId: target.id },
				headers: context.headers,
			}),
		);
		await recordAdminAction(context, {
			action: "admin.user.unban",
			targetUserId: target.id,
			reason: input.reason,
		});
		return { success: true };
	});
