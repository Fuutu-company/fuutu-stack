import {
	getOrganizationById,
	getPurchasesByOrganizationId,
	getUserById,
} from "@fuutu/db";
import { getPlanSubscription, resolvePaymentProvider } from "@fuutu/payments";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../orpc/middleware/rate-limit";
import { authProcedure } from "../../../orpc/procedures";
import {
	maskEmail,
	payerId,
	sanitizePaymentUrl,
	throwIfPaymentsDisabled,
} from "../shared";

/** Refusal reason: only the member who pays may open the org's portal. */
const PORTAL_PAYER_ONLY = "portal_payer_only";

/**
 * Only the payer opens an organization's portal — the checkout user of the
 * org's subscription, or the same email on the session (a re-created
 * account). The portal is the payer's whole provider customer: their
 * payment method and every subscription they pay, other orgs' included,
 * each with a cancel button. Everyone else gets `portal_payer_only` with
 * the payer masked; they can still cancel the org's plan in the app
 * (`payments.subscription.cancel`). Fails closed when no purchase of the
 * org names who pays through its customer.
 */
async function assertPortalPayer(
	organizationId: string,
	customerId: string,
	viewer: { id: string; email: string },
): Promise<void> {
	const purchases = await getPurchasesByOrganizationId(organizationId);
	const purchase = purchases.find((p) => p.customerId === customerId);
	const payer = purchase ? payerId(purchase) : null;
	const payerUser = payer ? await getUserById(payer) : null;
	const isPayer =
		(payer !== null && payer === viewer.id) ||
		(payerUser?.email != null &&
			payerUser.email.toLowerCase() === viewer.email.toLowerCase());
	if (isPayer) return;
	throw new ORPCError("PRECONDITION_FAILED", {
		message: "Only the member who pays can open the billing portal",
		data: {
			reason: PORTAL_PAYER_ONLY,
			...(payerUser?.email ? { payer: maskEmail(payerUser.email) } : {}),
		},
	});
}

const portalSchema = z.object({
	organizationId: z.string().min(1).optional(),
	returnUrl: z.string().optional(),
});

export const createBillingPortal = authProcedure({
	org: { permission: PERMISSIONS.PAYMENT.UPDATE, optional: true },
	denyImpersonation: true,
	sessionOnly: true,
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
			await assertPortalPayer(input.organizationId, customerId, context.user);
		} else {
			const subscription = await getPlanSubscription({
				userId: context.user.id,
			});
			if (!subscription?.customerId) {
				throw new ORPCError("NOT_FOUND", {
					message: "No active subscription found for this user",
				});
			}
			customerId = subscription.customerId;
		}
		try {
			const provider = resolvePaymentProvider();
			return await provider.createCustomerPortalLink({
				customerId,
				returnUrl: sanitizePaymentUrl(input.returnUrl),
			});
		} catch (err) {
			throwIfPaymentsDisabled(err);
		}
	});
