import { CREDIT_TOPUPS, resolvePaymentProvider } from "@fuutu/payments";
import { getCreditTopupPriceId } from "@fuutu/payments/config.server";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../orpc/middleware/rate-limit";
import { requireOrgPermissionAccess } from "../../../orpc/org-access";
import { protectedProcedure } from "../../../orpc/procedures";
import { sanitizePaymentUrl, throwIfPaymentsDisabled } from "../shared";

const topupSchema = z.object({
	topupId: z.string().min(1).max(200),
	organizationId: z.string().min(1).optional(),
	successUrl: z.string().optional(),
	cancelUrl: z.string().optional(),
});

export const createTopupCheckout = protectedProcedure
	.use(createRateLimitMiddleware({ endpoint: "paymentsMutation" }))
	.route({
		method: "POST",
		path: "/payments/topup-checkout",
		tags: ["Payments"],
		summary: "Create top-up checkout link",
		description:
			"Creates a provider checkout URL for a one-time credit top-up package.",
	})
	.input(topupSchema)
	.handler(async ({ input, context }) => {
		if (input.organizationId) {
			await requireOrgPermissionAccess(
				input.organizationId,
				context.user.id,
				PERMISSIONS.PAYMENT.CREATE,
				context,
			);
		}
		const priceId = getCreditTopupPriceId(input.topupId);
		const topup = CREDIT_TOPUPS.find((t) => t.id === input.topupId);
		if (!priceId || !topup) {
			throw new ORPCError("NOT_FOUND", {
				message: "Top-up package not available",
			});
		}
		try {
			const provider = resolvePaymentProvider();
			return await provider.createCheckoutLink({
				priceId,
				userId: context.user.id,
				organizationId: input.organizationId,
				successUrl: sanitizePaymentUrl(input.successUrl),
				cancelUrl: sanitizePaymentUrl(input.cancelUrl),
				// Session email — providers pre-fill the checkout form with it.
				customerEmail: context.user.email,
				metadata: {
					// One-time purchase — providers like Stripe need this to pick
					// mode "payment" instead of "subscription". Only topup_id is
					// echoed — webhook sync re-derives meter/amount from
					// CREDIT_TOPUPS, so echoed values would be forgeable.
					mode: "payment",
					topup_id: input.topupId,
				},
			});
		} catch (err) {
			throwIfPaymentsDisabled(err);
		}
	});
