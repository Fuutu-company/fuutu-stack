import { auth } from "@fuutu/auth";
import { z } from "zod";
import {
	createRateLimitMiddleware,
	protectedProcedure,
} from "../../../../orpc";
import { requireOrgRole } from "../../shared";

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
		const requiredRole = input.role === "owner" ? "owner" : "admin";
		await requireOrgRole(
			input.organizationId,
			context.user.id,
			requiredRole,
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
