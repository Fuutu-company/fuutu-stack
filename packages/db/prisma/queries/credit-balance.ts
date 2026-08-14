import { db } from "../client";
import type { CreditBalance } from "../generated/client";

export const getCreditBalance = (params: {
	userId?: string;
	organizationId?: string;
	meterKey: string;
}) =>
	db.creditBalance.findFirst({
		where: {
			OR: [
				{
					userId: params.userId ?? null,
					organizationId: params.organizationId ?? null,
					meterKey: params.meterKey,
				},
			],
		},
	});

export const getCreditBalancesForUser = (userId: string) =>
	db.creditBalance.findMany({
		where: { userId },
		orderBy: { meterKey: "asc" },
	});

export const getCreditBalancesForOrganization = (organizationId: string) =>
	db.creditBalance.findMany({
		where: { organizationId },
		orderBy: { meterKey: "asc" },
	});

export type UpsertCreditBalanceInput = {
	userId?: string | null;
	organizationId?: string | null;
	meterKey: string;
	recurringGranted?: number;
	recurringConsumed?: number;
	recurringPeriodEnd?: Date;
};

export const upsertCreditBalance = async (
	input: UpsertCreditBalanceInput,
): Promise<CreditBalance> => {
	const existing = await db.creditBalance.findFirst({
		where: {
			userId: input.userId ?? null,
			organizationId: input.organizationId ?? null,
			meterKey: input.meterKey,
		},
	});

	if (existing) {
		return db.creditBalance.update({
			where: { id: existing.id },
			data: {
				...(input.recurringGranted !== undefined && {
					recurringGranted: input.recurringGranted,
				}),
				...(input.recurringConsumed !== undefined && {
					recurringConsumed: input.recurringConsumed,
				}),
				...(input.recurringPeriodEnd !== undefined && {
					recurringPeriodEnd: input.recurringPeriodEnd,
				}),
			},
		});
	}

	return db.creditBalance.create({
		data: {
			userId: input.userId ?? null,
			organizationId: input.organizationId ?? null,
			meterKey: input.meterKey,
			recurringGranted: input.recurringGranted ?? 0,
			recurringConsumed: input.recurringConsumed ?? 0,
			recurringPeriodEnd: input.recurringPeriodEnd ?? new Date(),
		},
	});
};

export const incrementRecurringConsumed = (id: string, amount: number) =>
	db.creditBalance.update({
		where: { id },
		data: { recurringConsumed: { increment: amount } },
	});

export const resetRecurringBalance = (
	id: string,
	newPeriodEnd: Date,
	newGranted?: number,
) =>
	db.creditBalance.update({
		where: { id },
		data: {
			recurringConsumed: 0,
			recurringPeriodEnd: newPeriodEnd,
			...(newGranted !== undefined && { recurringGranted: newGranted }),
		},
	});
