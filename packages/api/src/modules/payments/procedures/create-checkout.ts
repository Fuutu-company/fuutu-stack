import { resolvePaymentProvider } from "@fuutu/payments";
import { PLAN_IDS, PLANS } from "@fuutu/payments/config";
import { getPlanPriceId } from "@fuutu/payments/config.server";
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
});

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
		const plan = PLANS[input.planId];
		if (plan.billingType === "free" || plan.billingType === "custom") {
			throw new ORPCError("BAD_REQUEST", {
				message: "This plan is not available for checkout",
			});
		}
		// Provider-side price/product IDs are resolved server-side from env —
		// clients must never pick the catalog price themselves. The env var
		// names are declared per plan in `PLANS[].priceIdEnvVars`; a
		// checkoutable plan without a mapping (or unset env var) fails closed.
		const priceId = getPlanPriceId(
			input.planId,
			input.interval ?? plan.interval ?? "month",
		);
		if (!priceId) {
			throw new ORPCError("PRECONDITION_FAILED", {
				message: "Checkout is not configured for this plan",
			});
		}
		try {
			const provider = resolvePaymentProvider();
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
			});
		} catch (err) {
			throwIfPaymentsDisabled(err);
		}
	});
