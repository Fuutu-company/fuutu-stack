import { auth } from "@fuutu/auth";
import { revokeOAuthTokensForUser } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../../orpc/middleware/rate-limit";
import { systemAdminProcedure } from "../../../../orpc/procedures";
import { recordAdminAction } from "../../audit";
import {
	adminIdSchema,
	assertNotAdmin,
	assertNotSelf,
	loadTargetUser,
	reasonSchema,
	withAuthErrors,
} from "../../shared";

const banUserInput = z.object({
	userId: adminIdSchema,
	reason: reasonSchema,
	/** Temporary ban until this moment; omitted = permanent. */
	expiresAt: z.coerce.date().optional(),
});

export const banUserProcedure = systemAdminProcedure(PERMISSIONS.USER.UPDATE)
	.use(createRateLimitMiddleware({ endpoint: "adminMutation" }))
	.route({
		method: "POST",
		path: "/admin/users/{userId}/ban",
		tags: ["Admin"],
		summary: "Ban user",
		description:
			"Bans a user (optionally until `expiresAt`), ends their sessions and OAuth grants. Not yourself, not another admin. System admin only.",
	})
	.input(banUserInput)
	.handler(async ({ input, context }) => {
		assertNotSelf(context.user.id, input.userId, "You cannot ban yourself");
		const target = await loadTargetUser(input.userId);
		assertNotAdmin(target, "Admins cannot be banned. Demote them first.");

		let banExpiresIn: number | undefined;
		if (input.expiresAt) {
			banExpiresIn = Math.ceil((input.expiresAt.getTime() - Date.now()) / 1000);
			if (banExpiresIn <= 0) {
				throw new ORPCError("BAD_REQUEST", {
					message: "The ban must end in the future",
				});
			}
		}

		await withAuthErrors(() =>
			auth.api.banUser({
				body: {
					userId: target.id,
					banReason: input.reason,
					...(banExpiresIn ? { banExpiresIn } : {}),
				},
				headers: context.headers,
			}),
		);
		// Better Auth ends the sessions; MCP refresh tokens outlive them.
		await revokeOAuthTokensForUser(target.id);

		await recordAdminAction(context, {
			action: "admin.user.ban",
			targetUserId: target.id,
			reason: input.reason,
		});
		return { success: true };
	});
