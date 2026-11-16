import { supportTransferOwnership } from "@fuutu/auth/admin-support";
import { PERMISSIONS, toOrgRole } from "@fuutu/rbac";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../../orpc/middleware/rate-limit";
import { systemAdminProcedure } from "../../../../orpc/procedures";
import { recordAdminAction } from "../../audit";
import { adminIdSchema, reasonSchema } from "../../shared";
import { memberNotFound, organizationIdSchema } from "../shared";

const transferOwnershipInput = z.object({
	organizationId: organizationIdSchema,
	/** The member who becomes the owner. */
	memberId: adminIdSchema,
	reason: reasonSchema,
});

export const transferOwnershipProcedure = systemAdminProcedure(
	PERMISSIONS.ADMIN_ORGANIZATION.UPDATE,
)
	.use(createRateLimitMiddleware({ endpoint: "adminMutation" }))
	.route({
		method: "POST",
		path: "/admin/organizations/{organizationId}/transfer-ownership",
		tags: ["Admin"],
		summary: "Transfer ownership",
		description:
			"Makes a member the organization's owner; every current owner becomes admin — in one transaction. System admin only.",
	})
	.input(transferOwnershipInput)
	.handler(async ({ input, context }) => {
		const result = await supportTransferOwnership({
			organizationId: input.organizationId,
			memberId: input.memberId,
		});
		if (result.status === "not_found") throw memberNotFound();
		const changed =
			result.demotedOwners > 0 || toOrgRole(result.previousRole) !== "owner";
		if (changed) {
			await recordAdminAction(context, {
				action: "admin.org.ownership_transfer",
				targetOrganizationId: input.organizationId,
				targetUserId: result.member.userId,
				reason: input.reason,
				changedFields: ["role"],
			});
		}
		return { success: true, changed, demotedOwners: result.demotedOwners };
	});
