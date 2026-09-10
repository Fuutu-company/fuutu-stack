import { auth } from "@fuutu/auth";
import { PERMISSIONS } from "@fuutu/rbac";
import { z } from "zod";
import { authProcedure, createRateLimitMiddleware } from "../../../orpc";
import { slugSchema } from "../shared";

const updateOrgSchema = z.object({
	organizationId: z.string().min(1),
	name: z.string().min(1).max(100).optional(),
	slug: slugSchema.optional(),
});

export const updateOrganization = authProcedure({
	org: { permission: PERMISSIONS.ORGANIZATION.UPDATE },
})
	.use(createRateLimitMiddleware({ endpoint: "organizationMutation" }))
	.route({
		method: "PATCH",
		path: "/organizations/{organizationId}",
		tags: ["Organizations"],
		summary: "Update organization",
		description:
			"Updates an organization's name and/or slug. Admin role required.",
	})
	.input(updateOrgSchema)
	.handler(async ({ input, context }) => {
		const org = await auth.api.updateOrganization({
			body: {
				organizationId: input.organizationId,
				data: {
					...(input.name ? { name: input.name } : {}),
					...(input.slug ? { slug: input.slug } : {}),
				},
			},
			headers: context.headers,
		});
		return org;
	});
