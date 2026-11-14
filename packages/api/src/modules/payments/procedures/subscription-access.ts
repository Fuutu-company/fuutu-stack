import { getPurchaseByProviderSubscriptionId } from "@fuutu/db";
import { isPaymentsEnabled, type PaymentProvider } from "@fuutu/payments";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import {
	type OrgAccessContext,
	requireOrgPermissionAccess,
} from "../../../orpc/org-access";

/** 501 on disabled installs — the noop provider id would miss the lookup and masquerade as NOT_FOUND. */
export function assertPaymentsEnabled(): void {
	if (!isPaymentsEnabled()) {
		throw new ORPCError("NOT_IMPLEMENTED", {
			message: "Payments are not enabled on this deployment",
		});
	}
}

/**
 * The caller may change `subscriptionId`: it exists at `provider`, and
 * belongs to the caller or to an org where they hold PAYMENT.UPDATE.
 * Returns the stored purchase.
 */
export async function requireSubscriptionAccess(
	provider: PaymentProvider,
	subscriptionId: string,
	userId: string,
	access: OrgAccessContext,
): Promise<{ status: string }> {
	const purchase = await getPurchaseByProviderSubscriptionId(
		provider.id,
		subscriptionId,
	);
	if (!purchase) {
		throw new ORPCError("NOT_FOUND", { message: "Subscription not found" });
	}
	if (purchase.organizationId) {
		await requireOrgPermissionAccess(
			purchase.organizationId,
			userId,
			PERMISSIONS.PAYMENT.UPDATE,
			access,
		);
	} else if (purchase.userId !== userId) {
		throw new ORPCError("FORBIDDEN", { message: "Not the owner" });
	}
	return purchase;
}
