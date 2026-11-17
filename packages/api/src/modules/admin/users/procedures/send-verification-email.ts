import { auth } from "@fuutu/auth";
import { authConfig } from "@fuutu/auth/config";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
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

export const sendVerificationEmailProcedure = systemAdminProcedure(
	PERMISSIONS.USER.UPDATE,
)
	.use(createRateLimitMiddleware({ endpoint: "adminMutation" }))
	.route({
		method: "POST",
		path: "/admin/users/{userId}/verification-email",
		tags: ["Admin"],
		summary: "Send verification email",
		description:
			"Sends the user the regular email-verification link. Only the mailbox owner can verify an address — admins never mark it verified. System admin only.",
	})
	.input(z.object({ userId: adminIdSchema, reason: reasonSchema.optional() }))
	.handler(async ({ input, context }) => {
		const target = await loadTargetUser(input.userId);
		if (target.emailVerified) {
			throw new ORPCError("CONFLICT", {
				message: "Email is already verified",
			});
		}
		// No headers: with the admin's session Better Auth would check the
		// address against the admin's own email.
		await withAuthErrors(() =>
			auth.api.sendVerificationEmail({
				body: {
					email: target.email,
					callbackURL: authConfig.redirects.afterEmailVerification,
				},
			}),
		);
		await recordAdminAction(context, {
			action: "admin.user.verification_email_send",
			targetUserId: target.id,
			reason: input.reason,
		});
		return { success: true };
	});
