import { getCreditBalanceSummary } from "@fuutu/credits";
import { PERMISSIONS } from "@fuutu/rbac";
import { z } from "zod";
import { permissionProcedure } from "../../../orpc";
import { requireOrgPermissionAccess } from "../../organizations/shared";

const balanceSchema = z.object({
	organizationId: z.string().uuid().optional(),
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
				context.headers,
			);
		}
		const summary = await getCreditBalanceSummary({
			userId: input.organizationId ? undefined : context.user.id,
			organizationId: input.organizationId,
		});
		return { balances: summary };
	});
