import { supportRemoveMember } from "@fuutu/auth/admin-support";
import { getOrganizationMemberForAdmin } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../../orpc/middleware/rate-limit";
import { systemAdminProcedure } from "../../../../orpc/procedures";
import { runAuditedAdminAction } from "../../audit";
import { adminIdSchema, reasonSchema } from "../../shared";
import {
	dispatchOrganizationEvent,
	memberNotFound,
	organizationIdSchema,
} from "../shared";

const removeMemberInput = z.object({
	organizationId: organizationIdSchema,
	memberId: adminIdSchema,
	reason: reasonSchema,
});

export const removeMemberProcedure = systemAdminProcedure(
	PERMISSIONS.ADMIN_ORGANIZATION.UPDATE,
)
	.use(createRateLimitMiddleware({ endpoint: "adminMutation" }))
	.route({
		method: "DELETE",
		path: "/admin/organizations/{organizationId}/members/{memberId}",
		tags: ["Admin"],
		summary: "Remove member",
		description:
			"Removes a member from the organization: their organization API keys are revoked and seats are synced with the payment provider. Never the last owner. Sends the `member.removed` webhook. System admin only.",
	})
	.input(removeMemberInput)
	.handler(async ({ input, context }) => {
		// Read first: the audit row names the user before anything is removed.
		const member = await getOrganizationMemberForAdmin(
			input.organizationId,
			input.memberId,
		);
		if (!member) throw memberNotFound();
		const result = await runAuditedAdminAction(
			context,
			{
				action: "admin.org.member_remove",
				targetOrganizationId: input.organizationId,
				targetUserId: member.userId,
				reason: input.reason,
			},
			async () => {
				const removed = await supportRemoveMember({
					organizationId: input.organizationId,
					memberId: member.id,
				});
				if (removed.status === "not_found") throw memberNotFound();
				if (removed.status === "last_owner") {
					throw new ORPCError("CONFLICT", {
						message:
							"The last owner cannot be removed. Transfer ownership first.",
					});
				}
				return removed;
			},
		);
		await dispatchOrganizationEvent({
			event: "member.removed",
			organizationId: input.organizationId,
			payload: {
				organizationId: input.organizationId,
				memberIdOrEmail: result.member.id,
			},
		});
		return { success: true };
	});
