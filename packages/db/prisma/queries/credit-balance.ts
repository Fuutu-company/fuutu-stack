import { z } from "zod";
import { db } from "../client";
import type { CreditBalance, CreditEvent, Prisma } from "../generated/client";
import { isUniqueViolation } from "./transaction";

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

// ─── Transactional operations ───────────────────────────────────────────────
// These wrap multi-step credit operations in db.$transaction() so callers
// never need direct access to the db client.

export type ConsumeCreditsTxResult = {
	ok: boolean;
	consumed: number;
	remaining: number;
	source: "recurring" | "topup" | "overage";
	error?: "credits_exceeded";
	deduplicated?: boolean;
};

/**
 * P2002 raised by the raw-SQL partial unique indexes
 * credit_event_user_idempotency_key /
 * credit_event_organization_idempotency_key. The indexes are not in the
 * Prisma schema, so the error surfaces with the constraint or column names
 * in meta.target/message — match on those rather than assuming every P2002
 * inside consume is a dedup hit.
 */
const isIdempotencyViolation = (err: unknown): boolean => {
	if (!isUniqueViolation(err)) return false;
	const target = (err as { meta?: { target?: unknown } }).meta?.target;
	const haystack = `${String(target)} ${
		err instanceof Error ? err.message : ""
	}`;
	return (
		haystack.includes("idempotencyKey") ||
		haystack.includes("credit_event_user_idempotency") ||
		haystack.includes("credit_event_organization_idempotency")
	);
};

/**
 * Control-flow signal thrown by the wrapped credit-event insert when the
 * idempotency index rejects a duplicate consume. Escapes the transaction
 * (rolling back the debit) so the outer catch can answer from the
 * already-committed winner instead of retrying a guaranteed conflict.
 */
class CreditEventDedupSignal extends Error {}

/**
 * P2002 raised by the raw-SQL partial unique index
 * credit_package_purchaseId_key. The index is not in the Prisma schema,
 * so the error surfaces with the constraint or column name in
 * meta.target/message — same shape as isIdempotencyViolation. Only a
 * violation targeting purchaseId is a duplicate top-up; any other P2002
 * is a real conflict and must propagate.
 */
const isPurchaseIdViolation = (err: unknown): boolean => {
	if (!isUniqueViolation(err)) return false;
	const target = (err as { meta?: { target?: unknown } }).meta?.target;
	const haystack = `${String(target)} ${
		err instanceof Error ? err.message : ""
	}`;
	return (
		haystack.includes("purchaseId") ||
		haystack.includes("credit_package_purchase")
	);
};

/**
 * Reserved metadata key on the keyed credit event: stores the result of
 * the original consume so a redelivery can replay the exact response.
 * Namespaced with a leading "__" to avoid collisions with user metadata.
 */
const DEDUP_METADATA_KEY = "__dedup";

const DedupSnapshotSchema = z.object({
	consumed: z.number(),
	remaining: z.number(),
	source: z.enum(["recurring", "topup", "overage"]),
});
type DedupSnapshot = z.infer<typeof DedupSnapshotSchema>;

/**
 * Replay a previously committed consume from the result snapshot stored on
 * the keyed event. Throws when the winner row or its snapshot is missing or
 * unparseable — a dedup hit must never report a debit that cannot be
 * proven.
 */
const toDeduplicatedResult = (
	event: Pick<CreditEvent, "metadata"> | null,
): ConsumeCreditsTxResult => {
	const metadata = event?.metadata;
	const raw =
		metadata && typeof metadata === "object" && !Array.isArray(metadata)
			? (metadata as Record<string, unknown>)[DEDUP_METADATA_KEY]
			: undefined;
	const parsed = DedupSnapshotSchema.safeParse(raw);
	if (!parsed.success) {
		throw new Error(
			"consume idempotency conflict: committed event has no result snapshot",
		);
	}
	return { ok: true, ...parsed.data, deduplicated: true };
};

export const consumeCreditsTx = async (params: {
	userId?: string;
	organizationId?: string;
	meterKey: string;
	amount: number;
	reason: string;
	metadata?: Record<string, unknown>;
	allowOverage: boolean;
	idempotencyKey?: string;
}): Promise<ConsumeCreditsTxResult> => {
	const {
		userId,
		organizationId,
		meterKey,
		amount,
		reason,
		metadata,
		allowOverage,
		idempotencyKey,
	} = params;

	try {
		return await withUniqueViolationRetry(() =>
			db.$transaction(async (tx) => {
				const owner = ownerWhere(userId, organizationId);

				// Dedup fast-path: a sequentially redelivered consume finds the
				// keyed event committed by the first delivery and replays its
				// recorded result without debiting. The partial unique indexes
				// still guard the concurrent race below.
				if (idempotencyKey) {
					const keyedEvent = await tx.creditEvent.findFirst({
						where: { ...owner, meterKey, idempotencyKey },
					});
					if (keyedEvent) return toDeduplicatedResult(keyedEvent);
				}

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
							recurringPeriodEnd: new Date(
								Date.now() + 30 * 24 * 60 * 60 * 1000,
							),
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
				const activePackages = packages.filter(
					(p) => p.amount - p.consumed > 0,
				);

				const recurringRemaining = Math.max(
					0,
					balance.recurringGranted - balance.recurringConsumed,
				);
				const topupRemaining = activePackages.reduce(
					(sum, p) => sum + (p.amount - p.consumed),
					0,
				);

				// Exactly one event per consume carries the idempotency key —
				// the first event insert. Keying every event would make a
				// multi-source consume violate its own unique index. The keyed
				// event's id is captured so the result snapshot can be recorded
				// on it once the final outcome is known.
				let pendingDedupKey: string | null = idempotencyKey ?? null;
				let dedupEventId: string | null = null;
				const createConsumeEvent = async (
					data: Prisma.CreditEventUncheckedCreateInput,
				) => {
					const keyForThisEvent = pendingDedupKey;
					const event = await tx.creditEvent
						.create({
							data: { ...data, idempotencyKey: keyForThisEvent },
						})
						.catch((err: unknown) => {
							if (idempotencyKey && isIdempotencyViolation(err)) {
								throw new CreditEventDedupSignal();
							}
							throw err;
						});
					if (keyForThisEvent) {
						pendingDedupKey = null;
						dedupEventId = event.id;
					}
					return event;
				};

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
					const fromRecurring = Math.min(
						recurringRemaining,
						remainingToConsume,
					);
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
					await createConsumeEvent({
						userId: userId ?? null,
						organizationId: organizationId ?? null,
						meterKey,
						amount: fromRecurring,
						source: "recurring",
						reason,
						metadata: (metadata ?? null) as Prisma.InputJsonValue,
					});
					recurringDebit = fromRecurring;
					remainingToConsume -= fromRecurring;
				}

				// 2. Consume from top-up packages
				for (const pkg of activePackages) {
					if (remainingToConsume <= 0) break;
					const fromPkg = Math.min(
						pkg.amount - pkg.consumed,
						remainingToConsume,
					);
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
					await createConsumeEvent({
						userId: userId ?? null,
						organizationId: organizationId ?? null,
						meterKey,
						amount: fromPkg,
						source: "topup",
						packageId: pkg.id,
						reason,
						metadata: (metadata ?? null) as Prisma.InputJsonValue,
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
					await createConsumeEvent({
						userId: userId ?? null,
						organizationId: organizationId ?? null,
						meterKey,
						amount: remainingToConsume,
						source: "overage",
						reason,
						metadata: (metadata ?? null) as Prisma.InputJsonValue,
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

				// `remaining`/`source` are best-effort snapshot values
				// computed from the pre-debit reads — a concurrent consume
				// committed after our snapshot can make them stale. They
				// describe the state this transaction observed, not a
				// guaranteed current balance.
				const remaining =
					Math.max(0, recurringRemaining - recurringDebit - overageDebit) +
					(topupRemaining - topupDebit);
				const source =
					amount <= recurringRemaining
						? ("recurring" as const)
						: amount <= recurringRemaining + topupRemaining
							? ("topup" as const)
							: ("overage" as const);

				// Record the outcome on the keyed event so a redelivered
				// consume replays the original response verbatim. Committed in
				// the same transaction — a racing duplicate can only observe a
				// keyed event that already carries its snapshot.
				if (dedupEventId) {
					const snapshot: DedupSnapshot = {
						consumed: amount,
						remaining,
						source,
					};
					await tx.creditEvent.update({
						where: { id: dedupEventId },
						data: {
							metadata: {
								...(metadata ?? {}),
								[DEDUP_METADATA_KEY]: snapshot,
							} as Prisma.InputJsonValue,
						},
					});
				}

				return {
					ok: true,
					consumed: amount,
					remaining,
					source,
				};
			}),
		);
	} catch (err) {
		// The idempotency index rejected a concurrent duplicate consume —
		// the winner's keyed event is committed; replay its recorded result.
		// A missing event or snapshot throws rather than fabricating a debit.
		if (!(err instanceof CreditEventDedupSignal) || !idempotencyKey) {
			throw err;
		}
		const keyedEvent = await db.creditEvent.findFirst({
			where: {
				...ownerWhere(userId, organizationId),
				meterKey,
				idempotencyKey,
			},
		});
		return toDeduplicatedResult(keyedEvent);
	}
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
				// Compare-and-swap, same semantics as
				// resetRecurringBalancesTx: apply only for a strictly newer
				// periodEnd, or the same periodEnd carrying a different
				// grant (plan change). A stale out-of-order grant (older
				// periodEnd) never regresses recurringPeriodEnd or re-zeros
				// recurringConsumed — that would re-spend consumed credits.
				// The guard lives inside updateMany so the check is atomic,
				// not a read-then-write race.
				const result = await tx.creditBalance.updateMany({
					where: {
						id: existing.id,
						OR: [
							{ recurringPeriodEnd: { lt: periodEnd } },
							{
								recurringPeriodEnd: periodEnd,
								recurringGranted: { not: amount },
							},
						],
					},
					data: {
						recurringGranted: amount,
						recurringConsumed: 0,
						recurringPeriodEnd: periodEnd,
					},
				});
				if (result.count === 0) return;
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
		// duplicate top-up grant (e.g. webhook redelivery) a no-op. Any
		// other unique violation is a real conflict — re-throw it.
		if (isPurchaseIdViolation(err)) return;
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
		const reset: CreditBalance[] = [];
		for (const balance of balances) {
			const newAmount = newGranted?.[balance.meterKey];
			// Compare-and-swap: skip only rows that already reflect this exact
			// reset — a redelivered renewal is a no-op, but a reset carrying a
			// different grant (plan change) or a newer period still applies.
			// A stale reset (older periodEnd) never regresses the row.
			const result = await tx.creditBalance.updateMany({
				where: {
					id: balance.id,
					...(newAmount === undefined
						? { recurringPeriodEnd: { lt: newPeriodEnd } }
						: {
								OR: [
									{ recurringPeriodEnd: { lt: newPeriodEnd } },
									{
										recurringPeriodEnd: newPeriodEnd,
										recurringGranted: { not: newAmount },
									},
								],
							}),
				},
				data: {
					recurringConsumed: 0,
					recurringPeriodEnd: newPeriodEnd,
					...(newAmount !== undefined && {
						recurringGranted: newAmount,
					}),
				},
			});
			if (result.count === 0) continue;
			reset.push(balance);
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
		return reset;
	});
};
