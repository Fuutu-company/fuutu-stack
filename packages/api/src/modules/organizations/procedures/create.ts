import { auth } from "@fuutu/auth";
import { countOrganizationsForUser } from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { PERMISSIONS } from "@fuutu/rbac";
import { dispatchEvent } from "@fuutu/webhooks";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../orpc/middleware/rate-limit";
import { authProcedure } from "../../../orpc/procedures";
import { slugSchema } from "../shared";

const log = createLogger({ scope: "api:organizations" });

const createOrgSchema = z.object({
	name: z.string().min(1).max(100),
	slug: slugSchema,
});

/**
 * Better Auth's per-user cap (`authConfig.organizations.organizationLimit`)
 * as a typed FORBIDDEN — a raw APIError would flatten to a 500.
 */
function toOrganizationLimitError(
	err: unknown,
): ORPCError<"FORBIDDEN", unknown> | null {
	if (
		!(err instanceof Error) ||
		err.name !== "APIError" ||
		!("body" in err) ||
		typeof err.body !== "object" ||
		err.body === null ||
		!("code" in err.body) ||
		err.body.code !== "YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS"
	) {
		return null;
	}
	return new ORPCError("FORBIDDEN", {
		status: 403,
		message: "Organization limit reached",
	});
}

export const createOrganization = authProcedure({
	systemPermission: PERMISSIONS.ORGANIZATION.CREATE,
	sessionOnly: true,
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
		let org: Awaited<ReturnType<typeof auth.api.createOrganization>>;
		try {
			org = await auth.api.createOrganization({
				body: { name: input.name, slug: input.slug },
				headers: context.headers,
			});
		} catch (err) {
			throw toOrganizationLimitError(err) ?? err;
		}
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
