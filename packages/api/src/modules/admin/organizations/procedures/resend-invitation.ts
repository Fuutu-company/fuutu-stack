import { supportResendInvitation } from "@fuutu/auth/admin-support";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../../orpc/middleware/rate-limit";
import { systemAdminProcedure } from "../../../../orpc/procedures";
import { toSeatLimitError } from "../../../organizations/seat-limit-error";
import { recordAdminAction } from "../../audit";
import { adminIdSchema } from "../../shared";
import { invitationNotFound, organizationIdSchema } from "../shared";

const resendInvitationInput = z.object({
	organizationId: organizationIdSchema,
	invitationId: adminIdSchema,
});

export const resendInvitationProcedure = systemAdminProcedure(
	PERMISSIONS.ADMIN_ORGANIZATION.UPDATE,
)
	.use(createRateLimitMiddleware({ endpoint: "adminMutation" }))
	.route({
		method: "POST",
		path: "/admin/organizations/{organizationId}/invitations/{invitationId}/resend",
		tags: ["Admin"],
		summary: "Resend invitation",
		description:
			"Restarts a pending invitation's validity and sends the invitation email again, in the original inviter's name. Reviving an expired invitation counts against the seat limit. System admin only.",
	})
	.input(resendInvitationInput)
	.handler(async ({ input, context }) => {
		let result: Awaited<ReturnType<typeof supportResendInvitation>>;
		try {
			result = await supportResendInvitation({
				organizationId: input.organizationId,
				invitationId: input.invitationId,
			});
		} catch (err) {
			throw toSeatLimitError(err) ?? err;
		}
		if (result.status === "not_found") throw invitationNotFound();
		if (result.status === "not_pending") {
			throw new ORPCError("CONFLICT", {
				message: "Only pending invitations can be resent",
			});
		}
		await recordAdminAction(context, {
			action: "admin.org.invitation_resend",
			targetOrganizationId: input.organizationId,
			targetInvitationId: result.invitation.id,
			changedFields: ["expiresAt"],
		});
		return {
			success: true,
			emailSent: result.emailSent,
			invitation: result.invitation,
		};
	});
