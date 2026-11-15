import { supportDeleteOrganization } from "@fuutu/auth/admin-support";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../../orpc/middleware/rate-limit";
import { systemAdminProcedure } from "../../../../orpc/procedures";
import { recordAdminAction } from "../../audit";
import { reasonSchema } from "../../shared";
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
			"Permanently deletes an organization with its members, invitations, API keys and billing records; subscriptions are cancelled first. Requires the organization's slug as `confirmSlug`. System admin only.",
	})
	.input(deleteOrganizationInput)
	.handler(async ({ input, context }) => {
		const org = await loadTargetOrganization(input.organizationId);
		if (input.confirmSlug.toLowerCase() !== org.slug.toLowerCase()) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Confirmation does not match the organization's slug",
			});
		}
		if (!(await supportDeleteOrganization(org.id))) {
			throw new ORPCError("NOT_FOUND", { message: "Organization not found" });
		}
		await recordAdminAction(context, {
			action: "admin.org.delete",
			targetOrganizationId: org.id,
			reason: input.reason,
		});
		return { success: true };
	});
