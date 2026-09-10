import { auth } from "@fuutu/auth";
import { hasRoleAtLeast, PERMISSIONS, toOrgRole } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { authProcedure, createRateLimitMiddleware } from "../../../../orpc";
import type { OrgMember } from "../../../organizations/shared";

const removeMemberSchema = z.object({
	organizationId: z.string().min(1),
	memberIdOrEmail: z.string().min(1),
});

export const removeMember = authProcedure({
	org: { permission: PERMISSIONS.REMOVE_ORGANIZATION },
})
	.use(createRateLimitMiddleware({ endpoint: "organizationMember" }))
	.route({
		method: "DELETE",
		path: "/organizations/{organizationId}/members/{memberIdOrEmail}",
		tags: ["Organizations"],
		summary: "Remove member",
		description:
			"Removes a member from the organization. Admin role required. Cannot remove the owner.",
	})
	.input(removeMemberSchema)
	.handler(async ({ input, context }) => {
		// context.org and context.orgRole are set by authorize middleware
		// (org option is not optional, so both are guaranteed defined)
		const actorRole = context.orgRole ?? "member";
		const target = context.org?.members?.find(
			(m: OrgMember) =>
				m.id === input.memberIdOrEmail ||
				m.userId === input.memberIdOrEmail ||
				m.email === input.memberIdOrEmail,
		);
		const targetRole = toOrgRole(target?.role);
		if (targetRole === "owner") {
			throw new ORPCError("FORBIDDEN", { message: "Cannot remove owner" });
		}
		if (
			!hasRoleAtLeast(actorRole, "owner") &&
			hasRoleAtLeast(targetRole, actorRole)
		) {
			throw new ORPCError("FORBIDDEN", {
				message: "Cannot remove member with equal or higher role",
			});
		}
		await auth.api.removeMember({
			body: {
				memberIdOrEmail: input.memberIdOrEmail,
				organizationId: input.organizationId,
			},
			headers: context.headers,
		});
		return { success: true };
	});
