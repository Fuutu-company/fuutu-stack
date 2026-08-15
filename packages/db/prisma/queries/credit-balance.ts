import { db } from "../client";
import type { CreditBalance, Prisma } from "../generated/client";

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

// ─── Transactional operations ───────────────────────────────────────────────
// These wrap multi-step credit operations in db.$transaction() so callers
// never need direct access to the db client.

export type ConsumeCreditsTxResult = {
	ok: boolean;
	consumed: number;
	remaining: number;
	source: "recurring" | "topup" | "overage";
	error?: "credits_exceeded";
};

export const consumeCreditsTx = (params: {
	userId?: string;
	organizationId?: string;
	meterKey: string;
	amount: number;
	reason: string;
	metadata?: Record<string, unknown>;
	allowOverage: boolean;
}): Promise<ConsumeCreditsTxResult> => {
	const {
		userId,
		organizationId,
		meterKey,
		amount,
		reason,
		metadata,
		allowOverage,
	} = params;

	return db.$transaction(async (tx) => {
		let balance = await tx.creditBalance.findFirst({
			where: {
				userId: userId ?? null,
				organizationId: organizationId ?? null,
				meterKey,
			},
		});
		if (!balance) {
			balance = await tx.creditBalance.create({
				data: {
					userId: userId ?? null,
					organizationId: organizationId ?? null,
					meterKey,
					recurringGranted: 0,
					recurringConsumed: 0,
					recurringPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
				},
			});
		}

		const recurringRemaining =
			balance.recurringGranted - balance.recurringConsumed;
		let remainingToConsume = amount;

		// 1. Consume from recurring first
		if (recurringRemaining > 0 && remainingToConsume > 0) {
			const fromRecurring = Math.min(recurringRemaining, remainingToConsume);
			// Use conditional updateMany to prevent double-spend race condition
			const result = await tx.creditBalance.updateMany({
				where: {
					id: balance.id,
					recurringConsumed: {
						lte: balance.recurringGranted - fromRecurring,
					},
				},
				data: { recurringConsumed: { increment: fromRecurring } },
			});
			if (result.count === 0) {
				throw new Error("Insufficient credits (concurrent consume)");
			}
			await tx.creditEvent.create({
				data: {
					userId: userId ?? null,
					organizationId: organizationId ?? null,
					meterKey,
					amount: fromRecurring,
					source: "recurring",
					reason,
					metadata: (metadata ?? null) as Prisma.InputJsonValue,
				},
			});
			remainingToConsume -= fromRecurring;
		}

		// 2. Consume from top-up packages
		if (remainingToConsume > 0) {
			const packages = await tx.creditPackage.findMany({
				where: {
					AND: [
						{
							OR: [
								{ userId: userId ?? null },
								{ organizationId: organizationId ?? null },
							],
						},
						{ meterKey },
						{
							OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
						},
					],
				},
				orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
			});
			const activePackages = packages.filter((p) => p.amount - p.consumed > 0);
			for (const pkg of activePackages) {
				if (remainingToConsume <= 0) break;
				const fromPkg = Math.min(pkg.amount - pkg.consumed, remainingToConsume);
				// Use conditional updateMany to prevent double-spend race condition
				const result = await tx.creditPackage.updateMany({
					where: {
						id: pkg.id,
						consumed: { lte: pkg.amount - fromPkg },
					},
					data: {
						consumed: { increment: fromPkg },
					},
				});
				if (result.count === 0) {
					throw new Error(
						"Insufficient credits (concurrent consume from package)",
					);
				}
				await tx.creditEvent.create({
					data: {
						userId: userId ?? null,
						organizationId: organizationId ?? null,
						meterKey,
						amount: fromPkg,
						source: "topup",
						packageId: pkg.id,
						reason,
						metadata: (metadata ?? null) as Prisma.InputJsonValue,
					},
				});
				remainingToConsume -= fromPkg;
			}
		}

		// 3. Overage
		if (remainingToConsume > 0 && allowOverage) {
			await tx.creditBalance.update({
				where: { id: balance.id },
				data: { recurringConsumed: { increment: remainingToConsume } },
			});
			await tx.creditEvent.create({
				data: {
					userId: userId ?? null,
					organizationId: organizationId ?? null,
					meterKey,
					amount: remainingToConsume,
					source: "overage",
					reason,
					metadata: (metadata ?? null) as Prisma.InputJsonValue,
				},
			});
			remainingToConsume = 0;
		}

		// 4. Not enough credits
		if (remainingToConsume > 0) {
			const finalBalance = await tx.creditBalance.findFirst({
				where: {
					userId: userId ?? null,
					organizationId: organizationId ?? null,
					meterKey,
				},
			});
			const finalRecurring = finalBalance
				? finalBalance.recurringGranted - finalBalance.recurringConsumed
				: 0;
			const packages = await tx.creditPackage.findMany({
				where: {
					AND: [
						{
							OR: [
								{ userId: userId ?? null },
								{ organizationId: organizationId ?? null },
							],
						},
						{ meterKey },
						{
							OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
						},
					],
				},
			});
			const finalTopup = packages.reduce(
				(sum: number, p) => sum + (p.amount - p.consumed),
				0,
			);
			return {
				ok: false,
				consumed: amount - remainingToConsume,
				remaining: Math.max(0, finalRecurring) + finalTopup,
				source: "recurring" as const,
				error: "credits_exceeded" as const,
			};
		}

		// Success — calculate total remaining
		const finalBalance = await tx.creditBalance.findFirst({
			where: {
				userId: userId ?? null,
				organizationId: organizationId ?? null,
				meterKey,
			},
		});
		const finalRecurring = finalBalance
			? finalBalance.recurringGranted - finalBalance.recurringConsumed
			: 0;
		const packages = await tx.creditPackage.findMany({
			where: {
				AND: [
					{
						OR: [
							{ userId: userId ?? null },
							{ organizationId: organizationId ?? null },
						],
					},
					{ meterKey },
					{
						OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
					},
				],
			},
		});
		const finalTopup = packages.reduce(
			(sum: number, p) => sum + (p.amount - p.consumed),
			0,
		);

		return {
			ok: true,
			consumed: amount,
			remaining: Math.max(0, finalRecurring) + finalTopup,
			source:
				recurringRemaining >= amount
					? ("recurring" as const)
					: ("topup" as const),
		};
	});
};

export const grantRecurringCreditsTx = (params: {
	userId?: string;
	organizationId?: string;
	meterKey: string;
	amount: number;
	periodEnd: Date;
}): Promise<void> => {
	const { userId, organizationId, meterKey, amount, periodEnd } = params;

	return db.$transaction(async (tx) => {
		const existing = await tx.creditBalance.findFirst({
			where: {
				userId: userId ?? null,
				organizationId: organizationId ?? null,
				meterKey,
			},
		});

		if (existing) {
			// Use updateMany to ensure row still exists (atomic operation)
			const result = await tx.creditBalance.updateMany({
				where: { id: existing.id },
				data: {
					recurringGranted: amount,
					recurringConsumed: 0,
					recurringPeriodEnd: periodEnd,
				},
			});
			if (result.count === 0) {
				throw new Error("Failed to grant credits (balance not found)");
			}
		} else {
			await tx.creditBalance.create({
				data: {
					userId: userId ?? null,
					organizationId: organizationId ?? null,
					meterKey,
					recurringGranted: amount,
					recurringConsumed: 0,
					recurringPeriodEnd: periodEnd,
				},
			});
		}

		await tx.creditEvent.create({
			data: {
				userId: userId ?? null,
				organizationId: organizationId ?? null,
				meterKey,
				amount,
				source: "admin_grant",
				reason: "subscription_grant",
			},
		});
	});
};

export const grantTopUpCreditsTx = (params: {
	userId?: string;
	organizationId?: string;
	meterKey: string;
	amount: number;
	expiresAt?: Date | null;
	purchaseId?: string | null;
	priority?: number;
}): Promise<void> => {
	const {
		userId,
		organizationId,
		meterKey,
		amount,
		expiresAt,
		purchaseId,
		priority,
	} = params;

	return db.$transaction(async (tx) => {
		await tx.creditPackage.create({
			data: {
				userId: userId ?? null,
				organizationId: organizationId ?? null,
				meterKey,
				amount,
				expiresAt: expiresAt ?? null,
				purchaseId: purchaseId ?? null,
				priority: priority ?? 10,
			},
		});

		await tx.creditEvent.create({
			data: {
				userId: userId ?? null,
				organizationId: organizationId ?? null,
				meterKey,
				amount,
				source: "admin_grant",
				reason: "topup_purchase",
			},
		});
	});
};

export const resetRecurringBalancesTx = async (params: {
	balances: CreditBalance[];
	userId?: string;
	organizationId?: string;
	newPeriodEnd: Date;
	newGranted?: Record<string, number>;
}): Promise<void> => {
	const { balances, userId, organizationId, newPeriodEnd, newGranted } = params;

	await db.$transaction(async (tx) => {
		for (const balance of balances) {
			const newAmount = newGranted?.[balance.meterKey];
			await tx.creditBalance.update({
				where: { id: balance.id },
				data: {
					recurringConsumed: 0,
					recurringPeriodEnd: newPeriodEnd,
					...(newAmount !== undefined && { recurringGranted: newAmount }),
				},
			});
			await tx.creditEvent.create({
				data: {
					userId: userId ?? null,
					organizationId: organizationId ?? null,
					meterKey: balance.meterKey,
					amount: 0,
					source: "reset",
					reason: "period_reset",
				},
			});
		}
	});
};
