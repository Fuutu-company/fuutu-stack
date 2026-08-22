import { auth } from "@fuutu/auth";
import { getInvitationOrganizationId } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import {
	createRateLimitMiddleware,
	protectedProcedure,
} from "../../../../orpc";
import { requireOrgPermissionAccess } from "../../shared";

const revokeInvitationSchema = z.object({
	invitationId: z.string().min(1),
});

export const revokeInvitation = protectedProcedure
	.use(createRateLimitMiddleware({ endpoint: "organizationMember" }))
	.route({
		method: "DELETE",
		path: "/organizations/invitations/{invitationId}",
		tags: ["Organizations"],
		summary: "Revoke invitation",
		description:
			"Revokes a pending organization invitation. Admin role required.",
	})
	.input(revokeInvitationSchema)
	.handler(async ({ input, context }) => {
		const invitation = await getInvitationOrganizationId(input.invitationId);
		if (!invitation) {
			throw new ORPCError("NOT_FOUND", { message: "Invitation not found" });
		}
		await requireOrgPermissionAccess(
			invitation.organizationId,
			context.user.id,
			PERMISSIONS.REMOVE_ORGANIZATION,
			context.headers,
		);
		await auth.api.cancelInvitation({
			body: { invitationId: input.invitationId },
			headers: context.headers,
		});
		return { success: true };
	});
