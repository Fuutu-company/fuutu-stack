import {
	type CancelMode,
	type PaymentProvider,
	resolvePaymentProvider,
} from "@fuutu/payments";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../orpc/middleware/rate-limit";
import {
	denyImpersonation,
	protectedProcedure,
	sessionOnly,
} from "../../../orpc/procedures";
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

/**
 * Is the subscription in a trial? The provider decides; when its lookup
 * fails (or it has none), the stored row counts only while its trial
 * period has not ended.
 */
async function isTrialing(
	provider: PaymentProvider,
	subscriptionId: string,
	stored: { status: string; currentPeriodEnd: Date | null },
): Promise<boolean> {
	try {
		if (provider.getSubscriptionStatus) {
			return (
				(await provider.getSubscriptionStatus(subscriptionId)) === "TRIALING"
			);
		}
	} catch {
		// fall through to the stored row
	}
	return (
		stored.status === "TRIALING" &&
		stored.currentPeriodEnd !== null &&
		stored.currentPeriodEnd.getTime() > Date.now()
	);
}

/**
 * The mode the cancel runs in. A provider that ends a trial on cancel
 * (`cancelEndsTrial`, Creem) has no cancel at trial end, so a trial is
 * canceled now even when the period end was asked for — and the response
 * says so.
 */
async function cancelModeFor(
	provider: PaymentProvider,
	subscriptionId: string,
	atPeriodEnd: boolean | undefined,
	stored: { status: string; currentPeriodEnd: Date | null },
): Promise<CancelMode> {
	if (!atPeriodEnd) return "immediate";
	if (
		provider.cancelEndsTrial &&
		(await isTrialing(provider, subscriptionId, stored))
	) {
		return "immediate";
	}
	return "period_end";
}

export const cancelSubscription = protectedProcedure
	.use(denyImpersonation)
	.use(sessionOnly)
	.use(createRateLimitMiddleware({ endpoint: "paymentsMutation" }))
	.route({
		method: "POST",
		path: "/payments/subscription/cancel",
		tags: ["Payments"],
		summary: "Cancel subscription",
		description:
			"Cancels an active subscription via the payment provider — now, or at the end of the current period with `atPeriodEnd`. A provider without a cancel at trial end (Creem) ends a trial now; `mode` in the response is the mode applied.",
	})
	.input(cancelSubscriptionSchema)
	.handler(async ({ input, context }) => {
		assertPaymentsEnabled();
		try {
			const provider = resolvePaymentProvider();
			const purchase = await requireSubscriptionAccess(
				provider,
				input.subscriptionId,
				context.user.id,
				context,
			);
			// Explicit mode — never the provider's store default.
			const mode = await cancelModeFor(
				provider,
				input.subscriptionId,
				input.atPeriodEnd,
				purchase,
			);
			await provider.cancelSubscription(input.subscriptionId, { mode });
			return { success: true, mode };
		} catch (err) {
			throwIfPaymentsDisabled(err);
		}
	});
