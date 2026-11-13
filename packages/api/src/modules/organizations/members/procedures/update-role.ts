import { auth } from "@fuutu/auth";
import { canChangeMemberRole, PERMISSIONS, toOrgRole } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../../orpc/middleware/rate-limit";
import { authProcedure } from "../../../../orpc/procedures";
import { findOrgMember } from "../find-member";

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
		const targetMember = await findOrgMember(
			input.organizationId,
			context.org?.members,
			input.memberId,
		);
		const targetRole = toOrgRole(input.role);
		if (targetMember.userId === context.user.id) {
			throw new ORPCError("FORBIDDEN", {
				message: "Cannot change your own role — use a transfer ownership flow",
			});
		}
		// Never above the actor's own role; only owners may touch a member at
		// or above their level — otherwise an admin could demote an owner and
		// then remove them (remove.ts's owner guard no longer applies).
		if (
			!canChangeMemberRole(actorRole, toOrgRole(targetMember.role), targetRole)
		) {
			throw new ORPCError("FORBIDDEN", {
				message: "Cannot change this member to that role",
			});
		}
		const result = await auth.api.updateMemberRole({
			body: {
				memberId: targetMember.id,
				role: input.role,
				organizationId: input.organizationId,
			},
			headers: context.headers,
		});
		return result;
	});
