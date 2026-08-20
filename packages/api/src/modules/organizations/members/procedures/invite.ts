import { auth } from "@fuutu/auth";
import { PERMISSIONS } from "@fuutu/rbac";
import { z } from "zod";
import {
	createRateLimitMiddleware,
	protectedProcedure,
} from "../../../../orpc";
import { requireOrgPermissionAccess } from "../../shared";

const inviteMemberSchema = z.object({
	organizationId: z.string().min(1),
	email: z.string().email(),
	role: z.enum(["owner", "admin", "member"]).default("member"),
});

export const inviteMember = protectedProcedure
	.use(createRateLimitMiddleware({ endpoint: "organizationMember" }))
	.route({
		method: "POST",
		path: "/organizations/{organizationId}/members/invite",
		tags: ["Organizations"],
		summary: "Invite member",
		description:
			"Sends an invitation to join the organization. Admin role required; owner role required to invite an owner.",
	})
	.input(inviteMemberSchema)
	.handler(async ({ input, context }) => {
		await requireOrgPermissionAccess(
			input.organizationId,
			context.user.id,
			PERMISSIONS.INVITE_ORGANIZATION,
			context.headers,
		);
		const invitation = await auth.api.createInvitation({
			body: {
				email: input.email,
				role: input.role,
				organizationId: input.organizationId,
			},
			headers: context.headers,
		});
		return invitation;
	});
