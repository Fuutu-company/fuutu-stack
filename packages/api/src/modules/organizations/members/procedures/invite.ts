import { auth } from "@fuutu/auth";
import { countOrganizationMembers } from "@fuutu/db";
import { hasRoleAtLeast, PERMISSIONS, toOrgRole } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { authProcedure, createRateLimitMiddleware } from "../../../../orpc";

const inviteMemberSchema = z.object({
	organizationId: z.string().min(1),
	email: z.string().email(),
	role: z.enum(["owner", "admin", "member"]).default("member"),
});

export const inviteMember = authProcedure({
	org: { permission: PERMISSIONS.INVITE_ORGANIZATION },
	limit: {
		key: "membersPerOrg",
		count: async (ctx) => countOrganizationMembers(ctx.org?.id ?? ""),
	},
})
	.use(createRateLimitMiddleware({ endpoint: "organizationMember" }))
	.route({
		method: "POST",
		path: "/organizations/{organizationId}/members/invite",
		tags: ["Organizations"],
		summary: "Invite member",
		description:
			"Sends an invitation to join the organization. Admin role required. Can only invite at or below your own role level (owner can invite owner; admin can invite admin/member).",
	})
	.input(inviteMemberSchema)
	.handler(async ({ input, context }) => {
		const actorRole = context.orgRole ?? "member";
		const targetRole = toOrgRole(input.role);
		if (!hasRoleAtLeast(actorRole, targetRole)) {
			throw new ORPCError("FORBIDDEN", {
				message: "Cannot invite a member with a higher role than your own",
			});
		}
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
