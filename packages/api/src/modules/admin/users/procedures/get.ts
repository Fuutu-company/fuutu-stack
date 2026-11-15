import { adminGetUserDetail } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../../orpc/middleware/rate-limit";
import { systemAdminProcedure } from "../../../../orpc/procedures";
import { adminIdSchema } from "../../shared";

export const getUserProcedure = systemAdminProcedure(PERMISSIONS.USER.VIEW)
	.use(createRateLimitMiddleware({ endpoint: "adminRead" }))
	.route({
		method: "GET",
		path: "/admin/users/{userId}",
		tags: ["Admin"],
		summary: "Get user",
		description:
			"Profile, sign-in methods, live sessions, organizations, API keys (prefix only), purchases and credit balances of one user. System admin only.",
	})
	.input(z.object({ userId: adminIdSchema }))
	.handler(async ({ input }) => {
		const user = await adminGetUserDetail(input.userId);
		if (!user) {
			throw new ORPCError("NOT_FOUND", { message: "User not found" });
		}
		return user;
	});
