import { resolvePaymentProvider } from "@fuutu/payments";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../orpc/middleware/rate-limit";
import { protectedProcedure } from "../../../orpc/procedures";
import { throwIfPaymentsDisabled } from "../shared";
import {
	assertPaymentsEnabled,
	requireSubscriptionAccess,
} from "./subscription-access";

const cancelSubscriptionSchema = z.object({
	subscriptionId: z.string().min(1).max(200),
	/** Cancel when the current period ends (resumable) instead of now. */
	atPeriodEnd: z.boolean().optional(),
});

export const cancelSubscription = protectedProcedure
	.use(createRateLimitMiddleware({ endpoint: "paymentsMutation" }))
	.route({
		method: "POST",
		path: "/payments/subscription/cancel",
		tags: ["Payments"],
		summary: "Cancel subscription",
		description:
			"Cancels an active subscription via the payment provider — now, or at the end of the current period with `atPeriodEnd`.",
	})
	.input(cancelSubscriptionSchema)
	.handler(async ({ input, context }) => {
		assertPaymentsEnabled();
		try {
			const provider = resolvePaymentProvider();
			await requireSubscriptionAccess(
				provider,
				input.subscriptionId,
				context.user.id,
				context,
			);
			// Explicit mode — never the provider's store default.
			await provider.cancelSubscription(input.subscriptionId, {
				mode: input.atPeriodEnd ? "period_end" : "immediate",
			});
			return { success: true };
		} catch (err) {
			throwIfPaymentsDisabled(err);
		}
	});
