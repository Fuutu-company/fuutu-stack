import { auth } from "@fuutu/auth";
import { z } from "zod";
import { createRateLimitMiddleware, permissionProcedure } from "../../../orpc";
import { slugSchema } from "../shared";

const createOrgSchema = z.object({
	name: z.string().min(1).max(100),
	slug: slugSchema,
});

export const createOrganization = permissionProcedure("create:organization")
	.use(createRateLimitMiddleware({ endpoint: "organizationMutation" }))
	.route({
		method: "POST",
		path: "/organizations",
		tags: ["Organizations"],
		summary: "Create organization",
		description: "Creates a new organization with the current user as owner.",
	})
	.input(createOrgSchema)
	.handler(async ({ input, context }) => {
		const org = await auth.api.createOrganization({
			body: { name: input.name, slug: input.slug },
			headers: context.headers,
		});
		return org;
	});
