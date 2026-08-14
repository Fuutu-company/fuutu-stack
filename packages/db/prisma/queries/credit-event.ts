import { db } from "../client";
import type { CreditEvent, Prisma } from "../generated/client";

export type CreateCreditEventInput = {
	userId?: string | null;
	organizationId?: string | null;
	meterKey: string;
	amount: number;
	source: string;
	packageId?: string | null;
	reason: string;
	metadata?: unknown;
};

export const createCreditEvent = (
	input: CreateCreditEventInput,
): Promise<CreditEvent> =>
	db.creditEvent.create({
		data: {
			userId: input.userId ?? null,
			organizationId: input.organizationId ?? null,
			meterKey: input.meterKey,
			amount: input.amount,
			source: input.source,
			packageId: input.packageId ?? null,
			reason: input.reason,
			metadata: input.metadata as Prisma.InputJsonValue,
		},
	});

export const getCreditEventsForUser = (userId: string, limit?: number) =>
	db.creditEvent.findMany({
		where: { userId },
		orderBy: { createdAt: "desc" },
		take: limit ?? 50,
	});

export const getCreditEventsForOrganization = (
	organizationId: string,
	limit?: number,
) =>
	db.creditEvent.findMany({
		where: { organizationId },
		orderBy: { createdAt: "desc" },
		take: limit ?? 50,
	});

export const getCreditEventsForMeter = (params: {
	userId?: string;
	organizationId?: string;
	meterKey: string;
	limit?: number;
}) =>
	db.creditEvent.findMany({
		where: {
			OR: [
				{ userId: params.userId },
				{ organizationId: params.organizationId },
			],
			meterKey: params.meterKey,
		},
		orderBy: { createdAt: "desc" },
		take: params.limit ?? 50,
	});
