import { auth } from "@fuutu/auth";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import {
	createRateLimitMiddleware,
	protectedProcedure,
} from "../../../../orpc";
import { requireOrgRole } from "../../shared";

const updateMemberRoleSchema = z.object({
	organizationId: z.string().min(1),
	memberId: z.string().min(1),
	role: z.enum(["owner", "admin", "member"]),
});

export const updateMemberRole = protectedProcedure
	.use(createRateLimitMiddleware({ endpoint: "organizationMember" }))
	.route({
		method: "PATCH",
		path: "/organizations/{organizationId}/members/{memberId}/role",
		tags: ["Organizations"],
		summary: "Update member role",
		description: "Changes a member's role. Owner role required.",
	})
	.input(updateMemberRoleSchema)
	.handler(async ({ input, context }) => {
		const org = await requireOrgRole(
			input.organizationId,
			context.user.id,
			"owner",
			context.headers,
		);
		const targetMember = org.members?.find((m) => m.id === input.memberId);
		if (
			targetMember &&
			targetMember.userId === context.user.id &&
			input.role !== "owner"
		) {
			throw new ORPCError("FORBIDDEN", {
				message: "Cannot demote yourself",
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
