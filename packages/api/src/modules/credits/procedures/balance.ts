import { getCreditBalanceSummary } from "@fuutu/credits";
import { PERMISSIONS } from "@fuutu/rbac";
import { z } from "zod";
import { requireOrgPermissionAccess } from "../../../orpc/org-access";
import { permissionProcedure } from "../../../orpc/procedures";

const balanceSchema = z.object({
	organizationId: z.string().min(1).optional(),
});

export const getBalance = permissionProcedure(PERMISSIONS.CREDIT.VIEW)
	.route({
		method: "GET",
		path: "/credits/balance",
		tags: ["Credits"],
		summary: "Get credit balances",
		description:
			"Returns all credit balances (recurring + top-ups) for the current user or organization.",
	})
	.input(balanceSchema)
	.handler(async ({ input, context }) => {
		if (input.organizationId) {
			await requireOrgPermissionAccess(
				input.organizationId,
				context.user.id,
				PERMISSIONS.CREDIT.VIEW,
				context,
			);
		}
		const summary = await getCreditBalanceSummary({
			userId: input.organizationId ? undefined : context.user.id,
			organizationId: input.organizationId,
		});
		return { balances: summary };
	});
