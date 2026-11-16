import { adminGetUserDetail } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../../orpc/middleware/rate-limit";
import { systemAdminProcedure } from "../../../../orpc/procedures";
import { withPlanId } from "../../organizations/shared";
import { adminIdSchema } from "../../shared";

export const getUserProcedure = systemAdminProcedure(PERMISSIONS.USER.VIEW)
	.use(createRateLimitMiddleware({ endpoint: "adminRead" }))
	.route({
		method: "GET",
		path: "/admin/users/{userId}",
		tags: ["Admin"],
		summary: "Get user",
		description:
			"Profile, sign-in methods, live sessions, organizations (each with its purchases and the plan that gates its access), API keys (prefix only), personal purchases and credit balances of one user. Purchases carry their plan. System admin only.",
	})
	.input(z.object({ userId: adminIdSchema }))
	.handler(async ({ input }) => {
		const user = await adminGetUserDetail(input.userId);
		if (!user) {
			throw new ORPCError("NOT_FOUND", { message: "User not found" });
		}
		return {
			...user,
			purchases: user.purchases.map(withPlanId),
			memberships: user.memberships.map((membership) => {
				const { purchases, activeSubscription, ...org } =
					membership.organization;
				return {
					...membership,
					organization: {
						...org,
						purchases: purchases.map(withPlanId),
						activeSubscription: activeSubscription
							? withPlanId(activeSubscription)
							: null,
					},
				};
			}),
		};
	});
