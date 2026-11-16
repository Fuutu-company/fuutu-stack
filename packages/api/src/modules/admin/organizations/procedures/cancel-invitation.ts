import {
	adminCancelOrganizationInvitation,
	adminGetOrganizationInvitation,
} from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../../orpc/middleware/rate-limit";
import { systemAdminProcedure } from "../../../../orpc/procedures";
import { recordAdminAction } from "../../audit";
import { adminIdSchema, reasonSchema } from "../../shared";
import { invitationNotFound, organizationIdSchema } from "../shared";

const cancelInvitationInput = z.object({
	organizationId: organizationIdSchema,
	invitationId: adminIdSchema,
	reason: reasonSchema.optional(),
});

const notPending = () =>
	new ORPCError("CONFLICT", {
		message: "Only pending invitations can be canceled",
	});

export const cancelInvitationProcedure = systemAdminProcedure(
	PERMISSIONS.ADMIN_ORGANIZATION.UPDATE,
)
	.use(createRateLimitMiddleware({ endpoint: "adminMutation" }))
	.route({
		method: "DELETE",
		path: "/admin/organizations/{organizationId}/invitations/{invitationId}",
		tags: ["Admin"],
		summary: "Cancel invitation",
		description:
			"Cancels a pending invitation of the organization — its link stops working. System admin only.",
	})
	.input(cancelInvitationInput)
	.handler(async ({ input, context }) => {
		const invitation = await adminGetOrganizationInvitation(
			input.organizationId,
			input.invitationId,
		);
		if (!invitation) throw invitationNotFound();
		if (invitation.status !== "pending") throw notPending();
		const canceled = await adminCancelOrganizationInvitation({
			organizationId: input.organizationId,
			invitationId: invitation.id,
		});
		if (canceled === 0) throw notPending();
		await recordAdminAction(context, {
			action: "admin.org.invitation_cancel",
			targetOrganizationId: input.organizationId,
			targetInvitationId: invitation.id,
			reason: input.reason,
			changedFields: ["status"],
		});
		return { success: true };
	});
