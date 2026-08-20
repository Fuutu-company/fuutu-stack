import { auth } from "@fuutu/auth";
import { z } from "zod";
import { permissionProcedure } from "../../../../orpc";
import { requireOrgPermissionAccess } from "../../shared";

const listInvitationsSchema = z.object({
	organizationId: z.string().min(1),
});

export const listInvitations = permissionProcedure("view:organization")
	.route({
		method: "GET",
		path: "/organizations/{organizationId}/invitations",
		tags: ["Organizations"],
		summary: "List pending invitations",
		description:
			"Returns pending invitations for an organization. Admin role required.",
	})
	.input(listInvitationsSchema)
	.handler(async ({ input, context }) => {
		await requireOrgPermissionAccess(
			input.organizationId,
			context.user.id,
			"view:organization",
			context.headers,
		);
		const invitations = await auth.api.listInvitations({
			query: { organizationId: input.organizationId },
			headers: context.headers,
		});
		return {
			items: invitations,
			total: invitations.length,
			page: 1,
			limit: invitations.length,
			totalPages: 1,
		};
	});
