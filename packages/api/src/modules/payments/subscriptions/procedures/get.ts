import { getPlanSubscription } from "@fuutu/payments";
import { PERMISSIONS } from "@fuutu/rbac";
import { z } from "zod";
import { requireOrgPermissionAccess } from "../../../../orpc/org-access";
import { protectedProcedure } from "../../../../orpc/procedures";

const subscriptionStatusSchema = z.object({
	organizationId: z.string().optional(),
});

export const getSubscription = protectedProcedure
	.route({
		method: "GET",
		path: "/payments/subscription",
		tags: ["Payments"],
		summary: "Get subscription status",
		description:
			"Returns the current subscription state for the user or organization.",
	})
	.input(subscriptionStatusSchema)
	.handler(async ({ input, context }) => {
		if (input.organizationId) {
			await requireOrgPermissionAccess(
				input.organizationId,
				context.user.id,
				PERMISSIONS.PAYMENT.VIEW,
				context,
			);
		}
		// The plan subscription — never an add-on (`Plan.addonOf`).
		const subscription = await getPlanSubscription(
			input.organizationId
				? { organizationId: input.organizationId }
				: { userId: context.user.id },
		);
		return {
			active: subscription !== null,
			subscription,
		};
	});
