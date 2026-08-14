import { getCreditBalanceSummary } from "@fuutu/credits";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc";
import { requireOrgRole } from "../../organizations/shared";

const balanceSchema = z.object({
	organizationId: z.string().optional(),
});

export const getBalance = protectedProcedure
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
			await requireOrgRole(
				input.organizationId,
				context.user.id,
				"member",
				context.headers,
			);
		}
		const summary = await getCreditBalanceSummary({
			userId: input.organizationId ? undefined : context.user.id,
			organizationId: input.organizationId,
		});
		return { balances: summary };
	});
