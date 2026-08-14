import {
	CREDIT_TOPUPS,
	getCreditTopupPriceId,
	resolvePaymentProvider,
} from "@fuutu/payments";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware, protectedProcedure } from "../../../orpc";
import { requireOrgRole } from "../../organizations/shared";
import { sanitizePaymentUrl } from "../shared";

const topupSchema = z.object({
	topupId: z.string().min(1),
	organizationId: z.string().uuid().optional(),
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
			await requireOrgRole(
				input.organizationId,
				context.user.id,
				"admin",
				context.headers,
			);
		}
		const priceId = getCreditTopupPriceId(input.topupId);
		const topup = CREDIT_TOPUPS.find((t) => t.id === input.topupId);
		if (!priceId || !topup) {
			throw new ORPCError("NOT_FOUND", {
				message: "Top-up package not available",
			});
		}
		const provider = resolvePaymentProvider();
		const result = await provider.createCheckoutLink({
			priceId,
			userId: context.user.id,
			organizationId: input.organizationId,
			successUrl: sanitizePaymentUrl(input.successUrl),
			cancelUrl: sanitizePaymentUrl(input.cancelUrl),
			metadata: {
				topup_id: input.topupId,
				meter_key: topup.meterKey,
				amount: topup.amount,
			},
		});
		return result;
	});
