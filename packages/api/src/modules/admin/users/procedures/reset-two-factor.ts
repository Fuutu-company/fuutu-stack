import { auth } from "@fuutu/auth";
import { adminResetTwoFactor } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../../orpc/middleware/rate-limit";
import { systemAdminProcedure } from "../../../../orpc/procedures";
import { runAuditedAdminAction } from "../../audit";
import {
	adminIdSchema,
	assertNotAdmin,
	assertNotSelf,
	loadTargetUser,
	reasonSchema,
	withAuthErrors,
} from "../../shared";

export const resetTwoFactorProcedure = systemAdminProcedure(
	PERMISSIONS.USER.UPDATE,
)
	.use(createRateLimitMiddleware({ endpoint: "adminMutation" }))
	.route({
		method: "POST",
		path: "/admin/users/{userId}/two-factor/reset",
		tags: ["Admin"],
		summary: "Reset two-factor authentication",
		description:
			"Turns 2FA off for a locked-out user (TOTP secret and backup codes deleted) and signs them out. Not for admins. System admin only.",
	})
	.input(z.object({ userId: adminIdSchema, reason: reasonSchema }))
	.handler(async ({ input, context }) => {
		assertNotSelf(
			context.user.id,
			input.userId,
			"Manage your own two-factor authentication in your account settings",
		);
		const target = await loadTargetUser(input.userId);
		assertNotAdmin(
			target,
			"Two-factor authentication of an admin cannot be reset. Demote them first.",
		);

		await runAuditedAdminAction(
			context,
			{
				action: "admin.user.two_factor_reset",
				targetUserId: target.id,
				reason: input.reason,
			},
			async () => {
				await adminResetTwoFactor(target.id);
				await withAuthErrors(() =>
					auth.api.revokeUserSessions({
						body: { userId: target.id },
						headers: context.headers,
					}),
				);
			},
		);
		return { success: true };
	});
