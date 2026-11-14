import { getPlanSubscription } from "@fuutu/payments";
import { PERMISSIONS } from "@fuutu/rbac";
import { z } from "zod";
import { requireOrgPermissionAccess } from "../../../../orpc/org-access";
import { protectedProcedure } from "../../../../orpc/procedures";

const activeSubscriptionSchema = z.object({
	organizationId: z.string().min(1).optional(),
});

export const getActiveSubscription = protectedProcedure
	.route({
		method: "GET",
		path: "/payments/subscription/active",
		tags: ["Payments"],
		summary: "Get active subscription",
		description:
			"Returns the active subscription for the user or organization, or null.",
	})
	.input(activeSubscriptionSchema)
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
		return subscription;
	});
