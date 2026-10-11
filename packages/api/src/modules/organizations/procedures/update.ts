import { auth } from "@fuutu/auth";
import { createLogger } from "@fuutu/logs";
import { PERMISSIONS } from "@fuutu/rbac";
import { dispatchEvent } from "@fuutu/webhooks";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../orpc/middleware/rate-limit";
import { authProcedure } from "../../../orpc/procedures";
import { slugSchema } from "../shared";

const log = createLogger({ scope: "api:organizations" });

const updateOrgSchema = z.object({
	organizationId: z.string().min(1),
	name: z.string().min(1).max(100).optional(),
	slug: slugSchema.optional(),
	logo: z.string().max(2048).nullable().optional(),
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
					...(input.logo !== undefined ? { logo: input.logo } : {}),
				},
			},
			headers: context.headers,
		});
		try {
			await dispatchEvent({
				event: "organization.updated",
				organizationId: input.organizationId,
				userId: context.user.id,
				payload: {
					organizationId: input.organizationId,
					...(input.name ? { name: input.name } : {}),
					...(input.slug ? { slug: input.slug } : {}),
					...(input.logo !== undefined ? { logo: input.logo } : {}),
				},
			});
		} catch (err) {
			log.warn("webhook dispatch failed", { err });
		}
		return org;
	});
