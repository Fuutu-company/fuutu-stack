import { resolvePaymentProvider } from "@fuutu/payments";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../orpc/middleware/rate-limit";
import { protectedProcedure } from "../../../orpc/procedures";
import { throwIfPaymentsDisabled } from "../shared";
import {
	assertPaymentsEnabled,
	requireSubscriptionAccess,
} from "./subscription-access";

const resumeSubscriptionSchema = z.object({
	subscriptionId: z.string().min(1).max(200),
});

export const resumeSubscription = protectedProcedure
	.use(createRateLimitMiddleware({ endpoint: "paymentsMutation" }))
	.route({
		method: "POST",
		path: "/payments/subscription/resume",
		tags: ["Payments"],
		summary: "Resume subscription",
		description:
			"Undoes a cancellation scheduled for the end of the period (`cancel` with `atPeriodEnd`).",
	})
	.input(resumeSubscriptionSchema)
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
			if (!provider.resumeSubscription) {
				throw new ORPCError("NOT_IMPLEMENTED", {
					message: "Resuming a subscription is not supported by this provider",
				});
			}
			await provider.resumeSubscription(input.subscriptionId);
			return { success: true };
		} catch (err) {
			throwIfPaymentsDisabled(err);
		}
	});
