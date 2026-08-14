import { getPurchaseByProviderSubscriptionId } from "@fuutu/db";
import { resolvePaymentProvider } from "@fuutu/payments";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware, protectedProcedure } from "../../../orpc";
import { requireOrgRole } from "../../organizations/shared";

const cancelSubscriptionSchema = z.object({
	subscriptionId: z.string().min(1),
});

export const cancelSubscription = protectedProcedure
	.use(createRateLimitMiddleware({ endpoint: "paymentsMutation" }))
	.route({
		method: "POST",
		path: "/payments/subscription/cancel",
		tags: ["Payments"],
		summary: "Cancel subscription",
		description: "Cancels an active subscription via the payment provider.",
	})
	.input(cancelSubscriptionSchema)
	.handler(async ({ input, context }) => {
		const provider = resolvePaymentProvider();
		const purchase = await getPurchaseByProviderSubscriptionId(
			provider.id,
			input.subscriptionId,
		);
		if (!purchase) {
			throw new ORPCError("NOT_FOUND", { message: "Subscription not found" });
		}
		if (purchase.organizationId) {
			await requireOrgRole(
				purchase.organizationId,
				context.user.id,
				"admin",
				context.headers,
			);
		} else if (purchase.userId !== context.user.id) {
			throw new ORPCError("FORBIDDEN", { message: "Not the owner" });
		}
		await provider.cancelSubscription(input.subscriptionId);
		return { success: true };
	});
