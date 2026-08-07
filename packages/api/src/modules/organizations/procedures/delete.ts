import { auth } from "@fuutu/auth";
import { z } from "zod";
import { createRateLimitMiddleware, protectedProcedure } from "../../../orpc";
import { requireOrgRole } from "../shared";

const deleteOrgSchema = z.object({
	organizationId: z.string().min(1),
});

export const deleteOrganization = protectedProcedure
	.use(createRateLimitMiddleware({ endpoint: "organizationMutation" }))
	.route({
		method: "DELETE",
		path: "/organizations/{organizationId}",
		tags: ["Organizations"],
		summary: "Delete organization",
		description: "Permanently deletes an organization. Owner role required.",
	})
	.input(deleteOrgSchema)
	.handler(async ({ input, context }) => {
		await requireOrgRole(
			input.organizationId,
			context.user.id,
			"owner",
			context.headers,
		);
		await auth.api.deleteOrganization({
			body: { organizationId: input.organizationId },
			headers: context.headers,
		});
		return { success: true };
	});
