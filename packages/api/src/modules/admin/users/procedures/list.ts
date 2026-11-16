import { adminCountUsers, adminListUsers } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../../orpc/middleware/rate-limit";
import { systemAdminProcedure } from "../../../../orpc/procedures";
import { pageSchema, queryBooleanSchema } from "../../shared";

const listUsersInput = z.object({
	/** Email or name (contains) or exact user id. */
	q: z.string().trim().max(200).optional(),
	role: z.enum(["admin", "user"]).optional(),
	banned: queryBooleanSchema.optional(),
	emailVerified: queryBooleanSchema.optional(),
	sort: z.enum(["createdAt", "email", "name"]).default("createdAt"),
	dir: z.enum(["asc", "desc"]).default("desc"),
	page: pageSchema,
	pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const listUsersProcedure = systemAdminProcedure(PERMISSIONS.USER.VIEW)
	.use(createRateLimitMiddleware({ endpoint: "adminRead" }))
	.route({
		method: "GET",
		path: "/admin/users",
		tags: ["Admin"],
		summary: "List users",
		description:
			"Search (email, name, id), filter (role, active ban, email verified), sort and page through all users. System admin only.",
	})
	.input(listUsersInput)
	.handler(async ({ input }) => {
		const { sort, dir, page, pageSize, ...filters } = input;
		const [items, total] = await Promise.all([
			adminListUsers({ ...filters, sort, dir, page, pageSize }),
			adminCountUsers(filters),
		]);
		return {
			items,
			page,
			pageSize,
			total,
			totalPages: Math.max(1, Math.ceil(total / pageSize)),
		};
	});
