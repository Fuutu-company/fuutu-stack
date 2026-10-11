import { auth } from "@fuutu/auth";
import { hasRoleAtLeast, PERMISSIONS, toOrgRole } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../../orpc/middleware/rate-limit";
import { authProcedure } from "../../../../orpc/procedures";

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
			(m: { id: string; userId: string; role: string }) =>
				m.id === input.memberId,
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
		// The actor must also outrank the target's CURRENT role — otherwise
		// an admin could demote an owner and then remove them (remove.ts's
		// owner guard no longer applies after the demotion).
		const currentRole = toOrgRole(targetMember?.role);
		if (
			!hasRoleAtLeast(actorRole, "owner") &&
			hasRoleAtLeast(currentRole, actorRole)
		) {
			throw new ORPCError("FORBIDDEN", {
				message: "Cannot change the role of a member with equal or higher role",
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
