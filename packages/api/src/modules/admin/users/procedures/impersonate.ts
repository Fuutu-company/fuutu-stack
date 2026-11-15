import { auth } from "@fuutu/auth";
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
	forwardSetCookies,
	loadTargetUser,
	reasonSchema,
	requireResponseHeaders,
	withAuthErrors,
} from "../../shared";

export const impersonateUserProcedure = systemAdminProcedure(
	PERMISSIONS.IMPERSONATE_USER,
)
	.use(createRateLimitMiddleware({ endpoint: "adminMutation" }))
	.route({
		method: "POST",
		path: "/admin/users/{userId}/impersonate",
		tags: ["Admin"],
		summary: "Impersonate user",
		description:
			"Signs the browser in as the user for `authConfig.admin.impersonationMinutes` (session cookies in the response). Never yourself, another admin or a banned user. Money, credentials and leaving or deleting organizations stay blocked. System admin only.",
	})
	.input(z.object({ userId: adminIdSchema, reason: reasonSchema }))
	.handler(async ({ input, context }) => {
		const resHeaders = requireResponseHeaders(context);
		assertNotSelf(
			context.user.id,
			input.userId,
			"You cannot impersonate yourself",
		);
		const target = await loadTargetUser(input.userId);
		assertNotAdmin(target, "Admins cannot be impersonated");
		if (target.isBanned) {
			throw new ORPCError("FORBIDDEN", {
				message: "Banned users cannot be impersonated",
			});
		}

		// Audited first: no impersonation session may exist without its row.
		await recordAdminAction(context, {
			action: "admin.user.impersonate_start",
			targetUserId: target.id,
			reason: input.reason,
		});

		const { headers, response } = await withAuthErrors(() =>
			auth.api.impersonateUser({
				body: { userId: target.id },
				headers: context.headers,
				returnHeaders: true,
			}),
		);
		forwardSetCookies(headers, resHeaders);
		return { success: true, expiresAt: response.session.expiresAt };
	});
