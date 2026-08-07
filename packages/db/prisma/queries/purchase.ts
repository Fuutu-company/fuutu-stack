import { db } from "../client";
import type { PurchaseStatus } from "../generated/client";

const ACTIVE_STATUSES: PurchaseStatus[] = ["ACTIVE", "TRIALING"];

export const getPurchasesByUserId = (userId: string) =>
	db.purchase.findMany({
		where: { userId },
		orderBy: { createdAt: "desc" },
	});

export const getPurchasesByOrganizationId = (organizationId: string) =>
	db.purchase.findMany({
		where: { organizationId },
		orderBy: { createdAt: "desc" },
	});

export const getActiveSubscriptionForUser = (userId: string) =>
	db.purchase.findFirst({
		where: { userId, type: "SUBSCRIPTION", status: { in: ACTIVE_STATUSES } },
	});

export const getActiveSubscriptionForOrganization = (organizationId: string) =>
	db.purchase.findFirst({
		where: {
			organizationId,
			type: "SUBSCRIPTION",
			status: { in: ACTIVE_STATUSES },
		},
	});

export const getPurchaseByProviderSubscriptionId = (
	provider: string,
	subscriptionId: string,
) =>
	db.purchase.findUnique({
		where: { provider_subscriptionId: { provider, subscriptionId } },
	});
