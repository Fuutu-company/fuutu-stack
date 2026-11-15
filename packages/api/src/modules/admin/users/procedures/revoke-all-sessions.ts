import { auth } from "@fuutu/auth";
import { revokeOAuthTokensForUser } from "@fuutu/db";
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

export const revokeAllUserSessionsProcedure = systemAdminProcedure(
	PERMISSIONS.USER.UPDATE,
)
	.use(createRateLimitMiddleware({ endpoint: "adminMutation" }))
	.route({
		method: "DELETE",
		path: "/admin/users/{userId}/sessions",
		tags: ["Admin"],
		summary: "Revoke all user sessions",
		description:
			"Signs the user out everywhere and revokes their OAuth (MCP) grants. System admin only.",
	})
	.input(z.object({ userId: adminIdSchema, reason: reasonSchema.optional() }))
	.handler(async ({ input, context }) => {
		const target = await loadTargetUser(input.userId);
		await withAuthErrors(() =>
			auth.api.revokeUserSessions({
				body: { userId: target.id },
				headers: context.headers,
			}),
		);
		await revokeOAuthTokensForUser(target.id);
		await recordAdminAction(context, {
			action: "admin.user.sessions_revoke_all",
			targetUserId: target.id,
			reason: input.reason,
		});
		return { success: true };
	});
