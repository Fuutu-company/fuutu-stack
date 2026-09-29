import { auth } from "@fuutu/auth";
import { countOrganizationsForUser } from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { PERMISSIONS } from "@fuutu/rbac";
import { dispatchEvent } from "@fuutu/webhooks";
import { z } from "zod";
import { authProcedure, createRateLimitMiddleware } from "../../../orpc";
import { slugSchema } from "../shared";

const log = createLogger({ scope: "api:organizations" });

const createOrgSchema = z.object({
	name: z.string().min(1).max(100),
	slug: slugSchema,
});

export const createOrganization = authProcedure({
	systemPermission: PERMISSIONS.ORGANIZATION.CREATE,
	limit: {
		key: "organizations",
		count: async (ctx) => countOrganizationsForUser(ctx.user.id),
	},
})
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
		if (org?.id) {
			try {
				await dispatchEvent({
					event: "organization.created",
					organizationId: org.id,
					userId: context.user.id,
					payload: {
						organizationId: org.id,
						name: org.name,
						slug: org.slug,
					},
				});
			} catch (err) {
				log.warn("webhook dispatch failed", { err });
			}
		}
		return org;
	});
