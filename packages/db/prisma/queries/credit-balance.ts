import { db } from "../client";
import type { CreditBalance, Prisma } from "../generated/client";

/**
 * Prisma unique-violation error code. Used to recover from
 * find-then-create races now that partial unique indexes enforce
 * one credit_balance row per owner+meter.
 */
const isUniqueViolation = (err: unknown): boolean =>
	err instanceof Error && "code" in err && err.code === "P2002";

/**
 * Re-run a transaction when a unique index rejects a concurrent
 * first-touch insert. The retry re-reads the winner's row and takes
 * the update path instead.
 */
const withUniqueViolationRetry = async <T>(
	fn: () => Promise<T>,
): Promise<T> => {
	const maxAttempts = 3;
	for (let attempt = 1; ; attempt++) {
		try {
			return await fn();
		} catch (err) {
			if (!isUniqueViolation(err) || attempt >= maxAttempts) throw err;
		}
	}
};

/**
 * Owner where clause for polymorphic credit tables. ANDs both columns
 * so a lookup for one owner can never match the other owner's rows
 * (or orphan rows). Exactly one of userId/organizationId should be
 * set — the DB enforces this via an XOR CHECK constraint.
 */
const ownerWhere = (
	userId?: string | null,
	organizationId?: string | null,
) => ({
	userId: userId ?? null,
	organizationId: organizationId ?? null,
});

export const getCreditBalance = (params: {
	userId?: string;
	organizationId?: string;
	meterKey: string;
}) =>
	db.creditBalance.findFirst({
		where: {
			...ownerWhere(params.userId, params.organizationId),
			meterKey: params.meterKey,
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
	const where = {
		...ownerWhere(input.userId, input.organizationId),
		meterKey: input.meterKey,
	};
	const updateData = {
		...(input.recurringGranted !== undefined && {
			recurringGranted: input.recurringGranted,
		}),
		...(input.recurringConsumed !== undefined && {
			recurringConsumed: input.recurringConsumed,
		}),
		...(input.recurringPeriodEnd !== undefined && {
			recurringPeriodEnd: input.recurringPeriodEnd,
		}),
	};
	const createData = {
		userId: input.userId ?? null,
		organizationId: input.organizationId ?? null,
		meterKey: input.meterKey,
		recurringGranted: input.recurringGranted ?? 0,
		recurringConsumed: input.recurringConsumed ?? 0,
		recurringPeriodEnd: input.recurringPeriodEnd ?? new Date(),
	};

	const existing = await db.creditBalance.findFirst({ where });
	if (existing) {
		return db.creditBalance.update({
			where: { id: existing.id },
			data: updateData,
		});
	}

	try {
		return await db.creditBalance.create({ data: createData });
	} catch (err) {
		if (!isUniqueViolation(err)) throw err;
		// Lost a concurrent first-touch race — the winner's row now exists.
		const winner = await db.creditBalance.findFirst({ where });
		if (!winner) throw err;
		return db.creditBalance.update({
			where: { id: winner.id },
			data: updateData,
		});
	}
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

	return withUniqueViolationRetry(() =>
		db.$transaction(async (tx) => {
			const owner = ownerWhere(userId, organizationId);
			let balance = await tx.creditBalance.findFirst({
				where: { ...owner, meterKey },
			});
			if (!balance) {
				// First touch — the partial unique indexes make this insert
				// race-safe; a P2002 here is retried by withUniqueViolationRetry.
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

			const packages = await tx.creditPackage.findMany({
				where: {
					AND: [
						owner,
						{ meterKey },
						{
							OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
						},
					],
				},
				orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
			});
			const activePackages = packages.filter((p) => p.amount - p.consumed > 0);

			const recurringRemaining = Math.max(
				0,
				balance.recurringGranted - balance.recurringConsumed,
			);
			const topupRemaining = activePackages.reduce(
				(sum, p) => sum + (p.amount - p.consumed),
				0,
			);

			// Sufficiency check BEFORE any writes — returning ok:false must
			// not leave a partial debit behind.
			if (!allowOverage && amount > recurringRemaining + topupRemaining) {
				return {
					ok: false,
					consumed: 0,
					remaining: recurringRemaining + topupRemaining,
					source: "recurring" as const,
					error: "credits_exceeded" as const,
				};
			}

			let remainingToConsume = amount;
			let recurringDebit = 0;
			let topupDebit = 0;
			let overageDebit = 0;

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
				recurringDebit = fromRecurring;
				remainingToConsume -= fromRecurring;
			}

			// 2. Consume from top-up packages
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
				topupDebit += fromPkg;
				remainingToConsume -= fromPkg;
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
				overageDebit = remainingToConsume;
				remainingToConsume = 0;
			}

			// Unreachable under the upfront sufficiency check — if a
			// concurrent mutation slipped past the conditional guards above,
			// roll back the whole transaction rather than commit a partial
			// debit.
			if (remainingToConsume > 0) {
				throw new Error("Insufficient credits (concurrent consume)");
			}

			const remaining =
				Math.max(0, recurringRemaining - recurringDebit - overageDebit) +
				(topupRemaining - topupDebit);

			return {
				ok: true,
				consumed: amount,
				remaining,
				source:
					amount <= recurringRemaining
						? ("recurring" as const)
						: amount <= recurringRemaining + topupRemaining
							? ("topup" as const)
							: ("overage" as const),
			};
		}),
	);
};

export const grantRecurringCreditsTx = (params: {
	userId?: string;
	organizationId?: string;
	meterKey: string;
	amount: number;
	periodEnd: Date;
}): Promise<void> => {
	const { userId, organizationId, meterKey, amount, periodEnd } = params;

	return withUniqueViolationRetry(() =>
		db.$transaction(async (tx) => {
			const existing = await tx.creditBalance.findFirst({
				where: {
					...ownerWhere(userId, organizationId),
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
		}),
	);
};

export const grantTopUpCreditsTx = async (params: {
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

	try {
		await db.$transaction(async (tx) => {
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
	} catch (err) {
		// A partial unique index on credit_package(purchaseId) makes a
		// duplicate top-up grant (e.g. webhook redelivery) a no-op.
		if (isUniqueViolation(err)) return;
		throw err;
	}
};

/**
 * Reset every recurring balance owned by the given user or org inside a
 * single transaction. Balances are fetched inside the tx so the reset
 * cannot observe a stale snapshot (TOCTOU). Returns the reset balances
 * so callers can log per-meter results.
 */
export const resetRecurringBalancesTx = (params: {
	userId?: string | null;
	organizationId?: string | null;
	newPeriodEnd: Date;
	newGranted?: Record<string, number>;
}): Promise<CreditBalance[]> => {
	const { userId, organizationId, newPeriodEnd, newGranted } = params;

	return db.$transaction(async (tx) => {
		const balances = await tx.creditBalance.findMany({
			where: ownerWhere(userId, organizationId),
		});
		for (const balance of balances) {
			const newAmount = newGranted?.[balance.meterKey];
			await tx.creditBalance.update({
				where: { id: balance.id },
				data: {
					recurringConsumed: 0,
					recurringPeriodEnd: newPeriodEnd,
					...(newAmount !== undefined && {
						recurringGranted: newAmount,
					}),
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
		return balances;
	});
};
