import { getActiveSubscriptionForUser, getOrganizationById } from "@fuutu/db";
import { resolvePaymentProvider } from "@fuutu/payments";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware, protectedProcedure } from "../../../orpc";
import { requireOrgRole } from "../../organizations/shared";
import { sanitizePaymentUrl } from "../shared";

const portalSchema = z.object({
	organizationId: z.string().optional(),
	returnUrl: z.string().optional(),
});

export const createBillingPortal = protectedProcedure
	.use(createRateLimitMiddleware({ endpoint: "paymentsMutation" }))
	.route({
		method: "POST",
		path: "/payments/portal",
		tags: ["Payments"],
		summary: "Open customer portal",
		description: "Creates a customer portal URL for managing billing.",
	})
	.input(portalSchema)
	.handler(async ({ input, context }) => {
		let customerId: string | undefined;
		if (input.organizationId) {
			await requireOrgRole(
				input.organizationId,
				context.user.id,
				"admin",
				context.headers,
			);
			const org = await getOrganizationById(input.organizationId);
			if (!org) {
				throw new ORPCError("NOT_FOUND", {
					message: "Organization not found",
				});
			}
			customerId = org.paymentsCustomerId ?? undefined;
			if (!customerId) {
				throw new ORPCError("BAD_REQUEST", {
					message: "No customer ID found for this organization",
				});
			}
		} else {
			const subscription = await getActiveSubscriptionForUser(context.user.id);
			if (!subscription?.customerId) {
				throw new ORPCError("NOT_FOUND", {
					message: "No active subscription found for this user",
				});
			}
			customerId = subscription.customerId;
		}
		const provider = resolvePaymentProvider();
		const result = await provider.createCustomerPortalLink({
			customerId,
			returnUrl: sanitizePaymentUrl(input.returnUrl),
		});
		return result;
	});
