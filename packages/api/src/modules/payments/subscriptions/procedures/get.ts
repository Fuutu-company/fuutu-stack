import {
	getActiveSubscriptionForOrganization,
	getActiveSubscriptionForUser,
} from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { z } from "zod";
import { protectedProcedure } from "../../../../orpc";
import { requireOrgPermissionAccess } from "../../../organizations/shared";

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
				context.headers,
			);
		}
		const subscription = input.organizationId
			? await getActiveSubscriptionForOrganization(input.organizationId)
			: await getActiveSubscriptionForUser(context.user.id);
		return {
			active: subscription !== null,
			subscription,
		};
	});
