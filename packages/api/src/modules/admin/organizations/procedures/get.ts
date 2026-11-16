import { adminGetOrganizationDetail } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../../orpc/middleware/rate-limit";
import { systemAdminProcedure } from "../../../../orpc/procedures";
import { organizationIdSchema, withPlanId } from "../shared";

export const getOrganizationProcedure = systemAdminProcedure(
	PERMISSIONS.ADMIN_ORGANIZATION.VIEW,
)
	.use(createRateLimitMiddleware({ endpoint: "adminRead" }))
	.route({
		method: "GET",
		path: "/admin/organizations/{organizationId}",
		tags: ["Admin"],
		summary: "Get organization",
		description:
			"Members, pending invitations, purchases with their plan, API keys (prefix only) and credit balances of one organization. System admin only — no membership needed.",
	})
	.input(z.object({ organizationId: organizationIdSchema }))
	.handler(async ({ input }) => {
		const org = await adminGetOrganizationDetail(input.organizationId);
		if (!org) {
			throw new ORPCError("NOT_FOUND", { message: "Organization not found" });
		}
		return { ...org, purchases: org.purchases.map(withPlanId) };
	});
