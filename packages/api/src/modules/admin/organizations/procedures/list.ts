import { adminCountOrganizations, adminListOrganizations } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../../orpc/middleware/rate-limit";
import { systemAdminProcedure } from "../../../../orpc/procedures";
import { pageSchema } from "../../shared";
import { withPlanId } from "../shared";

const listOrganizationsInput = z.object({
	/** Name or slug (contains) or exact organization id. */
	q: z.string().trim().max(200).optional(),
	sort: z.enum(["createdAt", "name", "members"]).default("createdAt"),
	dir: z.enum(["asc", "desc"]).default("desc"),
	page: pageSchema,
	pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const listOrganizationsProcedure = systemAdminProcedure(
	PERMISSIONS.ADMIN_ORGANIZATION.VIEW,
)
	.use(createRateLimitMiddleware({ endpoint: "adminRead" }))
	.route({
		method: "GET",
		path: "/admin/organizations",
		tags: ["Admin"],
		summary: "List organizations",
		description:
			"Search (name, slug, id), sort (created, name, member count) and page through all organizations, with member and pending-invitation counts and the plan of the subscription that gates access. System admin only.",
	})
	.input(listOrganizationsInput)
	.handler(async ({ input }) => {
		const { q, sort, dir, page, pageSize } = input;
		const [rows, total] = await Promise.all([
			adminListOrganizations({ q, sort, dir, page, pageSize }),
			adminCountOrganizations({ q }),
		]);
		return {
			items: rows.map(({ activeSubscription, ...org }) => ({
				...org,
				activeSubscription: activeSubscription
					? withPlanId(activeSubscription)
					: null,
			})),
			page,
			pageSize,
			total,
			totalPages: Math.max(1, Math.ceil(total / pageSize)),
		};
	});
