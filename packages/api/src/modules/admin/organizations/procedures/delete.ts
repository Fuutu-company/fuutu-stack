import { supportDeleteOrganization } from "@fuutu/auth/admin-support";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../../orpc/middleware/rate-limit";
import { systemAdminProcedure } from "../../../../orpc/procedures";
import { runAuditedAdminAction } from "../../audit";
import { reasonSchema, withSubscriptionCancellation } from "../../shared";
import { loadTargetOrganization, organizationIdSchema } from "../shared";

const deleteOrganizationInput = z.object({
	organizationId: organizationIdSchema,
	reason: reasonSchema,
	/** The organization's slug, typed by the admin — checked server-side. */
	confirmSlug: z.string().trim().min(1).max(64),
});

export const deleteOrganizationProcedure = systemAdminProcedure(
	PERMISSIONS.ADMIN_ORGANIZATION.DELETE,
)
	.use(createRateLimitMiddleware({ endpoint: "adminMutation" }))
	.route({
		method: "DELETE",
		path: "/admin/organizations/{organizationId}",
		tags: ["Admin"],
		summary: "Delete organization",
		description:
			"Permanently deletes an organization with its members, invitations, API keys and billing records; subscriptions are cancelled first and the delete aborts (502) when one cannot be. Requires the organization's slug as `confirmSlug`. System admin only.",
	})
	.input(deleteOrganizationInput)
	.handler(async ({ input, context }) => {
		const org = await loadTargetOrganization(input.organizationId);
		if (input.confirmSlug.toLowerCase() !== org.slug.toLowerCase()) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Confirmation does not match the organization's slug",
			});
		}
		await runAuditedAdminAction(
			context,
			{
				action: "admin.org.delete",
				targetOrganizationId: org.id,
				reason: input.reason,
			},
			async () => {
				const deleted = await withSubscriptionCancellation(() =>
					supportDeleteOrganization(org.id),
				);
				if (!deleted) {
					throw new ORPCError("NOT_FOUND", {
						message: "Organization not found",
					});
				}
			},
		);
		return { success: true };
	});
