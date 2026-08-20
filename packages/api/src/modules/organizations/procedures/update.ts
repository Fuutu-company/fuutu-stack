import { auth } from "@fuutu/auth";
import { z } from "zod";
import { createRateLimitMiddleware, permissionProcedure } from "../../../orpc";
import { requireOrgRole, slugSchema } from "../shared";

const updateOrgSchema = z.object({
	organizationId: z.string().min(1),
	name: z.string().min(1).max(100).optional(),
	slug: slugSchema.optional(),
});

export const updateOrganization = permissionProcedure("update:organization")
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
		await requireOrgRole(
			input.organizationId,
			context.user.id,
			"admin",
			context.headers,
		);
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
