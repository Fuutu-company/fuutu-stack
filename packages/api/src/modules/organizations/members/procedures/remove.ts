import { auth } from "@fuutu/auth";
import { hasRoleAtLeast, PERMISSIONS, toRbacRole } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import {
	createRateLimitMiddleware,
	protectedProcedure,
} from "../../../../orpc";
import { type OrgMember, requireOrgPermissionAccess } from "../../shared";

const removeMemberSchema = z.object({
	organizationId: z.string().min(1),
	memberIdOrEmail: z.string().min(1),
});

export const removeMember = protectedProcedure
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
		const org = await requireOrgPermissionAccess(
			input.organizationId,
			context.user.id,
			PERMISSIONS.REMOVE_ORGANIZATION,
			context.headers,
		);
		const actor = org.members?.find(
			(m: OrgMember) => m.userId === context.user.id,
		);
		const actorRole = toRbacRole(actor?.role);
		const target = org.members?.find(
			(m: OrgMember) =>
				m.id === input.memberIdOrEmail ||
				m.userId === input.memberIdOrEmail ||
				m.email === input.memberIdOrEmail,
		);
		const targetRole = toRbacRole(target?.role);
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
