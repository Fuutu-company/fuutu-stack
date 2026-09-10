import { auth } from "@fuutu/auth";
import { hasRoleAtLeast, PERMISSIONS, toOrgRole } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { authProcedure, createRateLimitMiddleware } from "../../../../orpc";

const updateMemberRoleSchema = z.object({
	organizationId: z.string().min(1),
	memberId: z.string().min(1),
	role: z.enum(["owner", "admin", "member"]),
});

export const updateMemberRole = authProcedure({
	org: { permission: PERMISSIONS.ORGANIZATION.UPDATE },
})
	.use(createRateLimitMiddleware({ endpoint: "organizationMember" }))
	.route({
		method: "PATCH",
		path: "/organizations/{organizationId}/members/{memberId}/role",
		tags: ["Organizations"],
		summary: "Update member role",
		description:
			"Changes a member's role. Admin role required. Can only assign at or below your own role (owner can assign owner; admin can assign admin/member). Cannot change your own role.",
	})
	.input(updateMemberRoleSchema)
	.handler(async ({ input, context }) => {
		const actorRole = context.orgRole ?? "member";
		const targetMember = context.org?.members?.find(
			(m: { id: string; userId: string }) => m.id === input.memberId,
		);
		const targetRole = toOrgRole(input.role);
		if (targetMember && targetMember.userId === context.user.id) {
			throw new ORPCError("FORBIDDEN", {
				message: "Cannot change your own role — use a transfer ownership flow",
			});
		}
		if (!hasRoleAtLeast(actorRole, targetRole)) {
			throw new ORPCError("FORBIDDEN", {
				message: "Cannot assign a role higher than your own",
			});
		}
		const result = await auth.api.updateMemberRole({
			body: {
				memberId: input.memberId,
				role: input.role,
				organizationId: input.organizationId,
			},
			headers: context.headers,
		});
		return result;
	});
