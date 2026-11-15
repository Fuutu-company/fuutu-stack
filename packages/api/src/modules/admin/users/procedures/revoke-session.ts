import { adminRevokeUserSession } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../../orpc/middleware/rate-limit";
import { systemAdminProcedure } from "../../../../orpc/procedures";
import { recordAdminAction } from "../../audit";
import { adminIdSchema, reasonSchema } from "../../shared";

const revokeSessionInput = z.object({
	userId: adminIdSchema,
	sessionId: adminIdSchema,
	reason: reasonSchema.optional(),
});

export const revokeUserSessionProcedure = systemAdminProcedure(
	PERMISSIONS.USER.UPDATE,
)
	.use(createRateLimitMiddleware({ endpoint: "adminMutation" }))
	.route({
		method: "DELETE",
		path: "/admin/users/{userId}/sessions/{sessionId}",
		tags: ["Admin"],
		summary: "Revoke user session",
		description:
			"Ends one session of the user, by session id (tokens never leave the server). System admin only.",
	})
	.input(revokeSessionInput)
	.handler(async ({ input, context }) => {
		const removed = await adminRevokeUserSession({
			userId: input.userId,
			sessionId: input.sessionId,
		});
		if (removed === 0) {
			throw new ORPCError("NOT_FOUND", { message: "Session not found" });
		}
		await recordAdminAction(context, {
			action: "admin.user.session_revoke",
			targetUserId: input.userId,
			reason: input.reason,
		});
		return { success: true };
	});
