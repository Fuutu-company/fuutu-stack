import { db } from "../client";
import type {
	Prisma,
	Purchase,
	PurchaseStatus,
	PurchaseType,
} from "../generated/client";

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

/**
 * Idempotency lookup for one-time checkouts: `metadata.checkoutEventId`
 * stores the provider's webhook event id (set by webhook sync). The partial
 * unique index "purchase_provider_checkoutEventId_key" is on the text
 * extraction `(provider, metadata ->> 'checkoutEventId')` — Prisma's JSON
 * `path`+`equals` filter emits a jsonb `#>` comparison the index does not
 * cover, so this uses parameterized raw SQL matching the index expression.
 */
export const getPurchaseByCheckoutEventId = async (
	provider: string,
	checkoutEventId: string,
): Promise<Purchase | null> => {
	const rows = await db.$queryRaw<Purchase[]>`
		SELECT * FROM "app"."purchase"
		WHERE "provider" = ${provider}
			AND "metadata" ->> 'checkoutEventId' = ${checkoutEventId}
		LIMIT 1
	`;
	return rows[0] ?? null;
};

/**
 * Trialing subscriptions ending within a reminder window, for the
 * subscription-reminder cron job. `currentPeriodEnd` must fall inside
 * [now, windowEnd] — trials already past their period end no longer
 * qualify for an "ending soon" reminder, and later-ending trials are
 * picked up by a subsequent daily run.
 *
 * Purchases are polymorphically owned (userId XOR organizationId). Org
 * members are returned unfiltered: `member.role` is a comma-separated
 * Better-Auth role string that SQL cannot exact-match (a `contains`
 * filter would also match custom roles like "co-owner"), so callers
 * filter for the org "owner" role themselves.
 */
export const getTrialingSubscriptions = (now: Date, windowEnd: Date) =>
	db.purchase.findMany({
		where: {
			type: "SUBSCRIPTION",
			status: "TRIALING",
			currentPeriodEnd: { gte: now, lte: windowEnd },
		},
		include: {
			user: { select: { locale: true } },
			organization: {
				select: {
					members: {
						select: {
							role: true,
							user: { select: { id: true, locale: true } },
						},
					},
				},
			},
		},
	});

export type CreatePurchaseInput = {
	type: PurchaseType;
	status: PurchaseStatus;
	provider: string;
	priceId: string;
	productId?: string | null;
	subscriptionId?: string | null;
	customerId?: string | null;
	quantity?: number;
	currentPeriodEnd?: Date | null;
	userId?: string | null;
	organizationId?: string | null;
	metadata?: unknown;
};

export const createPurchase = (input: CreatePurchaseInput): Promise<Purchase> =>
	db.purchase.create({
		data: {
			type: input.type,
			status: input.status,
			provider: input.provider,
			priceId: input.priceId,
			productId: input.productId ?? null,
			subscriptionId: input.subscriptionId ?? null,
			customerId: input.customerId ?? null,
			quantity: input.quantity ?? 1,
			currentPeriodEnd: input.currentPeriodEnd ?? null,
			userId: input.userId ?? null,
			organizationId: input.organizationId ?? null,
			metadata: input.metadata as Prisma.InputJsonValue,
		},
	});

export type UpdatePurchaseInput = {
	id: string;
	status?: PurchaseStatus;
	priceId?: string;
	productId?: string | null;
	currentPeriodEnd?: Date | null;
	customerId?: string | null;
	userId?: string | null;
	organizationId?: string | null;
	metadata?: unknown;
};

export const updatePurchase = (input: UpdatePurchaseInput): Promise<Purchase> =>
	db.purchase.update({
		where: { id: input.id },
		data: {
			...(input.status !== undefined && { status: input.status }),
			...(input.priceId !== undefined && { priceId: input.priceId }),
			...(input.productId !== undefined && { productId: input.productId }),
			...(input.currentPeriodEnd !== undefined && {
				currentPeriodEnd: input.currentPeriodEnd,
			}),
			...(input.customerId !== undefined && { customerId: input.customerId }),
			...(input.userId !== undefined && { userId: input.userId }),
			...(input.organizationId !== undefined && {
				organizationId: input.organizationId,
			}),
			...(input.metadata !== undefined && {
				metadata: input.metadata as Prisma.InputJsonValue,
			}),
		},
	});

export const updatePaymentsCustomerId = (
	userId: string,
	customerId: string,
): Promise<void> =>
	db.user
		.update({
			where: { id: userId },
			data: { paymentsCustomerId: customerId },
		})
		.then(() => undefined);
