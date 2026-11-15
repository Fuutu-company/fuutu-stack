import { supportSetMemberRole } from "@fuutu/auth/admin-support";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../../orpc/middleware/rate-limit";
import { systemAdminProcedure } from "../../../../orpc/procedures";
import { recordAdminAction } from "../../audit";
import { adminIdSchema, reasonSchema } from "../../shared";
import { memberNotFound, organizationIdSchema, orgRoleSchema } from "../shared";

const updateMemberRoleInput = z.object({
	organizationId: organizationIdSchema,
	memberId: adminIdSchema,
	role: orgRoleSchema,
	reason: reasonSchema,
});

export const updateMemberRoleProcedure = systemAdminProcedure(
	PERMISSIONS.ADMIN_ORGANIZATION.UPDATE,
)
	.use(createRateLimitMiddleware({ endpoint: "adminMutation" }))
	.route({
		method: "PATCH",
		path: "/admin/organizations/{organizationId}/members/{memberId}/role",
		tags: ["Admin"],
		summary: "Change member role",
		description:
			"Sets a member's organization role (owner, admin, member). The organization always keeps at least one owner. System admin only.",
	})
	.input(updateMemberRoleInput)
	.handler(async ({ input, context }) => {
		const result = await supportSetMemberRole({
			organizationId: input.organizationId,
			memberId: input.memberId,
			role: input.role,
		});
		if (result.status === "not_found") throw memberNotFound();
		if (result.status === "last_owner") {
			throw new ORPCError("CONFLICT", {
				message:
					"The organization needs at least one owner. Transfer ownership first.",
			});
		}
		const { id, userId, role } = result.member;
		if (result.status === "unchanged") {
			return { success: true, changed: false, member: { id, userId, role } };
		}
		await recordAdminAction(context, {
			action: "admin.org.member_role_update",
			targetOrganizationId: input.organizationId,
			targetUserId: userId,
			reason: input.reason,
			changedFields: ["role"],
		});
		return { success: true, changed: true, member: { id, userId, role } };
	});
