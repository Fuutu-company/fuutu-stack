import { getLifetimePurchase } from "@fuutu/payments";
import { getPlanForProductId } from "@fuutu/payments/config.server";
import { PERMISSIONS } from "@fuutu/rbac";
import { z } from "zod";
import { requireOrgPermissionAccess } from "../../../../orpc/org-access";
import { protectedProcedure } from "../../../../orpc/procedures";

const lifetimeSchema = z.object({
	organizationId: z.string().min(1).optional(),
});

/**
 * The active one-time plan purchase (lifetime access, `billingType:
 * "one_time"`) of the user or organization, or null — next to
 * `payments.subscription.active`, which knows subscriptions only.
 */
export const getLifetimePurchaseProcedure = protectedProcedure
	.route({
		method: "GET",
		path: "/payments/subscription/lifetime",
		tags: ["Payments"],
		summary: "Get lifetime purchase",
		description:
			"Returns the active one-time plan purchase (lifetime access) of the user or organization, or null: its plan (`planId`, null when the product maps to no plan), the purchase date and whether the provider portal holds its receipts (`receipts`).",
	})
	.input(lifetimeSchema)
	.handler(async ({ input, context }) => {
		if (input.organizationId) {
			await requireOrgPermissionAccess(
				input.organizationId,
				context.user.id,
				PERMISSIONS.PAYMENT.VIEW,
				context,
			);
		}
		const purchase = await getLifetimePurchase(
			input.organizationId
				? { organizationId: input.organizationId }
				: { userId: context.user.id },
		);
		if (!purchase) return null;
		const plan = getPlanForProductId(purchase.productId ?? purchase.priceId);
		return {
			id: purchase.id,
			planId: plan?.planId ?? null,
			purchasedAt: purchase.createdAt,
			receipts: purchase.customerId !== null,
		};
	});
