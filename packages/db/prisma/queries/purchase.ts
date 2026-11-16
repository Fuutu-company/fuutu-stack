import { db } from "../client";
import type {
	Prisma,
	Purchase,
	PurchaseStatus,
	PurchaseType,
} from "../generated/client";
import { assertSingleOwner } from "./owner";

const ACTIVE_STATUSES: PurchaseStatus[] = ["ACTIVE", "TRIALING"];

export const getPurchasesByUserId = (userId: string) =>
	db.purchase.findMany({
		where: { userId },
		orderBy: [{ createdAt: "desc" }, { id: "asc" }],
	});

export const getPurchasesByOrganizationId = (organizationId: string) =>
	db.purchase.findMany({
		where: { organizationId },
		orderBy: [{ createdAt: "desc" }, { id: "asc" }],
	});

/**
 * Every purchase a user checked out: their own, plus organization
 * purchases whose checkout metadata names them (`metadata.user_id`).
 * Newest first. Rows of deleted organizations are gone (cascade).
 */
export const getPurchasesCheckedOutByUser = (userId: string) =>
	db.purchase.findMany({
		where: {
			OR: [{ userId }, { metadata: { path: ["user_id"], equals: userId } }],
		},
		orderBy: [{ createdAt: "desc" }, { id: "asc" }],
	});

/**
 * Access-gating filter: ACTIVE/TRIALING, plus SCHEDULED_CANCEL while the
 * paid period still runs — "cancel at period end" keeps access until
 * currentPeriodEnd. Also self-heals: if the provider's cancel event
 * never arrives, access still stops at currentPeriodEnd.
 */
export const accessGatingWhere = (
	now: Date = new Date(),
): Prisma.PurchaseWhereInput => ({
	type: "SUBSCRIPTION",
	OR: [
		{ status: { in: ACTIVE_STATUSES } },
		{ status: "SCHEDULED_CANCEL", currentPeriodEnd: { gt: now } },
	],
});

/**
 * Newest first: with several access-gating subscriptions (a base plan
 * plus an add-on, or an upgrade whose old-subscription cancel failed at
 * the provider) the latest one wins deterministically.
 */
const NEWEST_FIRST: Prisma.PurchaseOrderByWithRelationInput[] = [
	{ createdAt: "desc" },
	{ id: "asc" },
];

export const getActiveSubscriptionForUser = (userId: string) =>
	db.purchase.findFirst({
		where: { userId, ...accessGatingWhere() },
		orderBy: NEWEST_FIRST,
	});

export const getActiveSubscriptionForOrganization = (organizationId: string) =>
	db.purchase.findFirst({
		where: { organizationId, ...accessGatingWhere() },
		orderBy: NEWEST_FIRST,
	});

export type PurchaseOwner = { userId: string } | { organizationId: string };

/**
 * Every access-gating organization subscription with the org's current
 * member count — the seat reconcile compares it to the billed quantity.
 */
export const getOrganizationSeatSubscriptions = async () => {
	const rows = await db.purchase.findMany({
		where: {
			organizationId: { not: null },
			subscriptionId: { not: null },
			...accessGatingWhere(),
		},
		select: {
			id: true,
			organizationId: true,
			subscriptionId: true,
			provider: true,
			productId: true,
			priceId: true,
			quantity: true,
			organization: { select: { _count: { select: { members: true } } } },
		},
		orderBy: NEWEST_FIRST,
	});
	return rows.flatMap((row) =>
		row.organizationId && row.subscriptionId
			? [
					{
						purchaseId: row.id,
						organizationId: row.organizationId,
						subscriptionId: row.subscriptionId,
						provider: row.provider,
						productId: row.productId,
						priceId: row.priceId,
						quantity: row.quantity,
						memberCount: row.organization?._count.members ?? 0,
					},
				]
			: [],
	);
};

/** Every access-gating subscription of one owner, newest first. */
export const getActiveSubscriptionsForOwner = (owner: PurchaseOwner) =>
	db.purchase.findMany({
		where: {
			...("organizationId" in owner
				? { organizationId: owner.organizationId }
				: { userId: owner.userId }),
			...accessGatingWhere(),
		},
		orderBy: NEWEST_FIRST,
	});

/**
 * Lifetime access: an ACTIVE one-time purchase of a plan product
 * (`billingType: "one_time"`). `productIds` are the plans' provider price
 * ids — credit top-ups are one-time purchases too and must not count.
 * Latest purchase first. No ids → no one-time plans configured → null.
 */
export const getActiveOneTimePlanPurchase = async (
	owner: PurchaseOwner,
	productIds: string[],
): Promise<Purchase | null> => {
	if (productIds.length === 0) return null;
	return db.purchase.findFirst({
		where: {
			...owner,
			type: "ONE_TIME",
			status: "ACTIVE",
			productId: { in: productIds },
		},
		orderBy: [{ createdAt: "desc" }, { id: "asc" }],
	});
};

export const getPurchaseByProviderSubscriptionId = (
	provider: string,
	subscriptionId: string,
) =>
	db.purchase.findUnique({
		where: { provider_subscriptionId: { provider, subscriptionId } },
	});

/**
 * Key in `Purchase.metadata` that holds the provider's payment reference
 * of a one-time purchase (Stripe payment intent, Creem checkout, Polar
 * checkout/order) — a refund or dispute names the purchase by it.
 */
export const PURCHASE_PAYMENT_REF_KEY = "fuutu_payment_ref";

/** The one-time purchase a refund or dispute names by its payment reference. */
export const getOneTimePurchaseByPaymentRef = (
	provider: string,
	paymentRef: string,
): Promise<Purchase | null> =>
	db.purchase.findFirst({
		where: {
			provider,
			type: "ONE_TIME",
			metadata: { path: [PURCHASE_PAYMENT_REF_KEY], equals: paymentRef },
		},
		orderBy: [{ createdAt: "desc" }, { id: "asc" }],
	});

/**
 * Idempotency lookup for one-time checkouts by the provider's webhook event
 * id — backed by the partial unique index "purchase_provider_checkoutEventId_key".
 */
export const getPurchaseByCheckoutEventId = (
	provider: string,
	checkoutEventId: string,
): Promise<Purchase | null> =>
	db.purchase.findFirst({ where: { provider, checkoutEventId } });

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
	/** Provider webhook event id of a one-time checkout (idempotency key). */
	checkoutEventId?: string | null;
};

export const createPurchase = (
	input: CreatePurchaseInput,
): Promise<Purchase> => {
	assertSingleOwner(input);
	return db.purchase.create({
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
			checkoutEventId: input.checkoutEventId ?? null,
		},
	});
};

export type UpdatePurchaseInput = {
	id: string;
	status?: PurchaseStatus;
	priceId?: string;
	productId?: string | null;
	currentPeriodEnd?: Date | null;
	customerId?: string | null;
	quantity?: number;
	userId?: string | null;
	organizationId?: string | null;
	metadata?: unknown;
};

export const updatePurchase = (
	input: UpdatePurchaseInput,
): Promise<Purchase> => {
	if (input.userId && input.organizationId) assertSingleOwner(input);
	return db.purchase.update({
		where: { id: input.id },
		data: {
			...(input.status !== undefined && { status: input.status }),
			...(input.priceId !== undefined && { priceId: input.priceId }),
			...(input.productId !== undefined && { productId: input.productId }),
			...(input.currentPeriodEnd !== undefined && {
				currentPeriodEnd: input.currentPeriodEnd,
			}),
			...(input.customerId !== undefined && { customerId: input.customerId }),
			...(input.quantity !== undefined && { quantity: input.quantity }),
			...(input.userId !== undefined && { userId: input.userId }),
			...(input.organizationId !== undefined && {
				organizationId: input.organizationId,
			}),
			...(input.metadata !== undefined && {
				metadata: input.metadata as Prisma.InputJsonValue,
			}),
		},
	});
};

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
