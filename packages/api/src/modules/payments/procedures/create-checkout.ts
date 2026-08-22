import { resolvePaymentProvider } from "@fuutu/payments";
import { PERMISSIONS } from "@fuutu/rbac";
import { z } from "zod";
import { createRateLimitMiddleware, protectedProcedure } from "../../../orpc";
import { requireOrgPermissionAccess } from "../../organizations/shared";
import { sanitizePaymentUrl } from "../shared";

const checkoutSchema = z.object({
	priceId: z.string().min(1).max(200),
	organizationId: z.string().uuid().optional(),
	successUrl: z.string().optional(),
	cancelUrl: z.string().optional(),
	seats: z.number().int().min(1).optional(),
});

export const createCheckout = protectedProcedure
	.use(createRateLimitMiddleware({ endpoint: "paymentsMutation" }))
	.route({
		method: "POST",
		path: "/payments/checkout",
		tags: ["Payments"],
		summary: "Create checkout link",
		description: "Creates a provider checkout URL for the given price ID.",
	})
	.input(checkoutSchema)
	.handler(async ({ input, context }) => {
		if (input.organizationId) {
			await requireOrgPermissionAccess(
				input.organizationId,
				context.user.id,
				PERMISSIONS.PAYMENT.CREATE,
				context.headers,
			);
		}
		const provider = resolvePaymentProvider();
		// seats is used for seat-based plans (quantity on Stripe, units on Creem)
		const result = await provider.createCheckoutLink({
			priceId: input.priceId,
			userId: context.user.id,
			organizationId: input.organizationId,
			successUrl: sanitizePaymentUrl(input.successUrl),
			cancelUrl: sanitizePaymentUrl(input.cancelUrl),
			seats: input.seats,
		});
		return result;
	});
