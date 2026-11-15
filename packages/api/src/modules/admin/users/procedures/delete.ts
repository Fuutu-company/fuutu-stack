import { auth } from "@fuutu/auth";
import { supportCancelUserSubscriptions } from "@fuutu/auth/admin-support";
import { listSoleOwnedOrganizations } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
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
	withSubscriptionCancellation,
} from "../../shared";

const deleteUserInput = z.object({
	userId: adminIdSchema,
	reason: reasonSchema,
	/** The user's email, typed by the admin — checked server-side. */
	confirmEmail: z.string().trim().min(1).max(254),
});

export const deleteUserProcedure = systemAdminProcedure(PERMISSIONS.USER.DELETE)
	.use(createRateLimitMiddleware({ endpoint: "adminMutation" }))
	.route({
		method: "DELETE",
		path: "/admin/users/{userId}",
		tags: ["Admin"],
		summary: "Delete user",
		description:
			"Permanently deletes a user (subscriptions are cancelled first; the delete aborts with 502 when one cannot be). Requires the user's email as `confirmEmail`. Refused for yourself, other admins and sole owners of an organization. System admin only.",
	})
	.input(deleteUserInput)
	.handler(async ({ input, context }) => {
		assertNotSelf(context.user.id, input.userId, "You cannot delete yourself");
		const target = await loadTargetUser(input.userId);
		assertNotAdmin(target, "Admins cannot be deleted. Demote them first.");
		if (input.confirmEmail.toLowerCase() !== target.email.toLowerCase()) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Confirmation does not match the user's email",
			});
		}
		const soleOwned = await listSoleOwnedOrganizations(target.id);
		if (soleOwned.length > 0) {
			throw new ORPCError("CONFLICT", {
				message:
					"The user is the only owner of an organization. Transfer ownership or delete the organization first.",
				data: {
					organizations: soleOwned.map(({ id, slug }) => ({ id, slug })),
				},
			});
		}

		await runAuditedAdminAction(
			context,
			{
				action: "admin.user.delete",
				targetUserId: target.id,
				reason: input.reason,
			},
			async () => {
				// Better Auth's delete hook cancels too, but only logs a failure.
				await withSubscriptionCancellation(() =>
					supportCancelUserSubscriptions(target.id),
				);
				await withAuthErrors(() =>
					auth.api.removeUser({
						body: { userId: target.id },
						headers: context.headers,
					}),
				);
			},
		);
		return { success: true };
	});
