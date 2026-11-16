import { auth } from "@fuutu/auth";
import { env } from "@fuutu/env/saas";
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

/** Same page the "Forgot password" form sends users to. */
const RESET_PASSWORD_PATH = "/auth/reset-password";

export const sendPasswordResetProcedure = systemAdminProcedure(
	PERMISSIONS.USER.UPDATE,
)
	.use(createRateLimitMiddleware({ endpoint: "adminMutation" }))
	.route({
		method: "POST",
		path: "/admin/users/{userId}/password-reset",
		tags: ["Admin"],
		summary: "Send password reset email",
		description:
			"Sends the user the regular password-reset email. Admins never set passwords. System admin only.",
	})
	.input(z.object({ userId: adminIdSchema, reason: reasonSchema.optional() }))
	.handler(async ({ input, context }) => {
		const target = await loadTargetUser(input.userId);
		const appUrl = env.NEXT_PUBLIC_SAAS_URL ?? env.BETTER_AUTH_URL;
		await withAuthErrors(() =>
			auth.api.requestPasswordReset({
				body: {
					email: target.email,
					redirectTo: `${appUrl}${RESET_PASSWORD_PATH}`,
				},
			}),
		);
		await recordAdminAction(context, {
			action: "admin.user.password_reset_send",
			targetUserId: target.id,
			reason: input.reason,
		});
		return { success: true };
	});
