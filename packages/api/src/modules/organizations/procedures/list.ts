import { auth } from "@fuutu/auth";
import { PERMISSIONS } from "@fuutu/rbac";
import { z } from "zod";
import { permissionProcedure } from "../../../orpc";

const listOrganizationsSchema = z.object({
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(100).default(50),
});

export const listOrganizations = permissionProcedure(
	PERMISSIONS.ORGANIZATION.VIEW,
)
	.route({
		method: "GET",
		path: "/organizations",
		tags: ["Organizations"],
		summary: "List user's organizations",
		description: "Returns paginated organizations the current user belongs to.",
	})
	.input(listOrganizationsSchema)
	.handler(async ({ input, context }) => {
		const orgs = await auth.api.listOrganizations({
			headers: context.headers,
		});
		const total = orgs.length;
		const skip = (input.page - 1) * input.limit;
		const items = orgs.slice(skip, skip + input.limit);
		return {
			items,
			page: input.page,
			limit: input.limit,
			total,
			totalPages: Math.max(1, Math.ceil(total / input.limit)),
		};
	});
