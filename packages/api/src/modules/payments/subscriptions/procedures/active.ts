import {
	getActiveSubscriptionForOrganization,
	getActiveSubscriptionForUser,
} from "@fuutu/db";
import { z } from "zod";
import { protectedProcedure } from "../../../../orpc";
import { requireOrgRole } from "../../../organizations/shared";

const activeSubscriptionSchema = z.object({
	organizationId: z.string().optional(),
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
			await requireOrgRole(
				input.organizationId,
				context.user.id,
				"member",
				context.headers,
			);
		}
		const subscription = input.organizationId
			? await getActiveSubscriptionForOrganization(input.organizationId)
			: await getActiveSubscriptionForUser(context.user.id);
		return subscription;
	});
