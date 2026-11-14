import {
	assertCheckoutAllowed,
	CheckoutRejectedError,
	resolvePaymentProvider,
} from "@fuutu/payments";
import { PLAN_IDS, PLANS, type Plan } from "@fuutu/payments/config";
import {
	getPlanNoTrialPriceId,
	getPlanPriceId,
} from "@fuutu/payments/config.server";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../orpc/middleware/rate-limit";
import { authProcedure } from "../../../orpc/procedures";
import { sanitizePaymentUrl, throwIfPaymentsDisabled } from "../shared";

const checkoutSchema = z.object({
	planId: z.enum(PLAN_IDS),
	interval: z.enum(["month", "year"]).optional(),
	organizationId: z.string().min(1).optional(),
	successUrl: z.string().optional(),
	cancelUrl: z.string().optional(),
	seats: z.number().int().min(1).optional(),
	/** Buy now without the plan's trial. */
	skipTrial: z.boolean().optional(),
});

/** Rejection reason when a checkout must skip the trial but the provider cannot (no no-trial product). */
const TRIAL_UNAVAILABLE = "trial_unavailable";

export const createCheckout = authProcedure({
	org: { permission: PERMISSIONS.PAYMENT.CREATE, optional: true },
})
	.use(createRateLimitMiddleware({ endpoint: "paymentsMutation" }))
	.route({
		method: "POST",
		path: "/payments/checkout",
		tags: ["Payments"],
		summary: "Create checkout link",
		description: "Creates a provider checkout URL for the given plan.",
	})
	.input(checkoutSchema)
	.handler(async ({ input, context }) => {
		// Widened to `Plan`: the `as const` catalog narrows to the shipped
		// plans, but a kit user may add one-time plans.
		const plan: Plan = PLANS[input.planId];
		if (plan.billingType === "free" || plan.billingType === "custom") {
			throw new ORPCError("BAD_REQUEST", {
				message: "This plan is not available for checkout",
			});
		}
		const interval = input.interval ?? plan.interval ?? "month";
		// Billing rules: an add-on (`Plan.addonOf`) needs an active base,
		// plus every app guard (`registerCheckoutGuard`). The owner mirrors
		// the webhook's: the organization when one is passed (its access
		// was checked by authProcedure), else the signed-in user.
		let trial: boolean;
		try {
			({ trial } = await assertCheckoutAllowed({
				owner: input.organizationId
					? { organizationId: input.organizationId }
					: { userId: context.user.id },
				userId: context.user.id,
				planId: input.planId,
				interval,
				seats: input.seats,
				skipTrial: input.skipTrial,
			}));
		} catch (err) {
			if (err instanceof CheckoutRejectedError) {
				throw new ORPCError("PRECONDITION_FAILED", {
					message: "This plan can't be purchased right now",
					data: { reason: err.reason },
				});
			}
			throw err;
		}
		// Provider-side price/product IDs are resolved server-side from env —
		// clients must never pick the catalog price themselves. The env var
		// names are declared per plan in `PLANS[].priceIdEnvVars`; a
		// checkoutable plan without a mapping (or unset env var) fails closed.
		// Without the trial: the plan's no-trial product when it has one.
		const priceId = getPlanPriceId(input.planId, interval, { trial });
		if (!priceId) {
			throw new ORPCError("PRECONDITION_FAILED", {
				message: "Checkout is not configured for this plan",
			});
		}
		// One-time plans are a single charge (lifetime access); trials only
		// apply to subscriptions.
		const isOneTime = plan.billingType === "one_time";
		const trialDays = trial ? plan.trialDays : undefined;
		try {
			const provider = resolvePaymentProvider();
			// Product-level trials (Creem): without a no-trial product the
			// checkout would hand out the trial anyway — fail closed.
			if (
				!trial &&
				!isOneTime &&
				plan.trialDays &&
				provider.trialsOnProduct &&
				!getPlanNoTrialPriceId(input.planId, interval)
			) {
				throw new ORPCError("PRECONDITION_FAILED", {
					message: "This plan can't be purchased right now",
					data: { reason: TRIAL_UNAVAILABLE },
				});
			}
			// seats is used for seat-based plans (quantity on Stripe, units on Creem)
			return await provider.createCheckoutLink({
				priceId,
				userId: context.user.id,
				organizationId: input.organizationId,
				successUrl: sanitizePaymentUrl(input.successUrl),
				cancelUrl: sanitizePaymentUrl(input.cancelUrl),
				seats: input.seats,
				// Session email, not client input — providers pre-fill the
				// checkout form with it.
				customerEmail: context.user.email,
				...(isOneTime
					? { metadata: { mode: "payment" } }
					: { trial, ...(trialDays ? { trialDays } : {}) }),
			});
		} catch (err) {
			throwIfPaymentsDisabled(err);
		}
	});
