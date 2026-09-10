import { auth } from "@fuutu/auth";
import { PERMISSIONS } from "@fuutu/rbac";
import { z } from "zod";
import { authProcedure, createRateLimitMiddleware } from "../../../orpc";

const deleteOrgSchema = z.object({
	organizationId: z.string().min(1),
});

export const deleteOrganization = authProcedure({
	org: { permission: PERMISSIONS.ORGANIZATION.DELETE },
})
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
		await auth.api.deleteOrganization({
			body: { organizationId: input.organizationId },
			headers: context.headers,
		});
		return { success: true };
	});
