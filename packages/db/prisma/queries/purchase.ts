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

export const getTrialingSubscriptions = () =>
	db.purchase.findMany({
		where: { type: "SUBSCRIPTION", status: "TRIALING" },
		include: { user: { select: { locale: true } } },
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
