import { getActiveSubscriptionForUser, getOrganizationById } from "@fuutu/db";
import { resolvePaymentProvider } from "@fuutu/payments";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { authProcedure, createRateLimitMiddleware } from "../../../orpc";
import { sanitizePaymentUrl } from "../shared";

const portalSchema = z.object({
	organizationId: z.string().uuid().optional(),
	returnUrl: z.string().optional(),
});

export const createBillingPortal = authProcedure({
	org: { permission: PERMISSIONS.PAYMENT.UPDATE, optional: true },
})
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
