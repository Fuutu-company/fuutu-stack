import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../prisma/client", () => ({
	db: {
		$transaction: vi.fn(),
		creditBalance: {
			findFirst: vi.fn(),
			findMany: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn(),
		},
		creditPackage: {
			findMany: vi.fn(),
			updateMany: vi.fn(),
		},
		creditEvent: {
			create: vi.fn(),
			findFirst: vi.fn(),
			update: vi.fn(),
		},
	},
}));

import { db } from "../../prisma/client";
import * as creditBalanceQueries from "../../prisma/queries/credit-balance";

function makeP2002(target: string[]): Error {
	return Object.assign(
		new Error(
			`Unique constraint failed on the fields: (${target.map((t) => `\`${t}\``).join(",")})`,
		),
		{ code: "P2002", meta: { target } },
	);
}

function makeP2002OnConstraint(constraintName: string): Error {
	return Object.assign(
		new Error(
			`Unique constraint failed on the constraint: \`${constraintName}\``,
		),
		{ code: "P2002", meta: { constraint: constraintName } },
	);
}

function makeBalance(overrides: Record<string, unknown> = {}) {
	return {
		id: "b-1",
		userId: "user-1",
		organizationId: null,
		meterKey: "ai_tokens",
		recurringGranted: 100,
		recurringConsumed: 0,
		recurringPeriodEnd: new Date("2026-02-01"),
		...overrides,
	};
}

function makeTx(overrides: {
	balance?: unknown;
	balances?: unknown[];
	packages?: unknown[];
	keyedEvent?: unknown;
	updateManyCount?: number;
}) {
	return {
		creditBalance: {
			findFirst: vi.fn().mockResolvedValue(overrides.balance ?? null),
			findMany: vi.fn().mockResolvedValue(overrides.balances ?? []),
			create: vi.fn().mockResolvedValue(overrides.balance ?? { id: "b-new" }),
			update: vi.fn(),
			updateMany: vi
				.fn()
				.mockResolvedValue({ count: overrides.updateManyCount ?? 1 }),
		},
		creditPackage: {
			findMany: vi.fn().mockResolvedValue(overrides.packages ?? []),
			updateMany: vi.fn().mockResolvedValue({ count: 1 }),
		},
		creditEvent: {
			create: vi.fn().mockResolvedValue({ id: "evt-1" }),
			findFirst: vi.fn().mockResolvedValue(overrides.keyedEvent ?? null),
			update: vi.fn().mockResolvedValue({ id: "evt-1" }),
		},
	};
}

async function runTx(tx: unknown) {
	vi.mocked(db.$transaction).mockImplementation(
		async (callback) => (await callback(tx as never)) as never,
	);
}

const consumeParams = {
	userId: "user-1",
	meterKey: "ai_tokens",
	amount: 50,
	reason: "test",
	allowOverage: false,
};

describe("credit idempotency", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("resetRecurringBalancesTx", () => {
		it("skips a byte-identical redelivered reset for the same periodEnd", async () => {
			const periodEnd = new Date("2026-03-01");
			const resetBalance = makeBalance({
				recurringConsumed: 0,
				recurringPeriodEnd: periodEnd,
			});
			const tx = makeTx({ balances: [resetBalance] });
			await runTx(tx);

			// First delivery applies the reset; the redelivery finds the row
			// already at newPeriodEnd and the WHERE guard rejects the update.
			tx.creditBalance.updateMany
				.mockResolvedValueOnce({ count: 1 })
				.mockResolvedValueOnce({ count: 0 });

			await creditBalanceQueries.resetRecurringBalancesTx({
				userId: "user-1",
				newPeriodEnd: periodEnd,
			});
			const skipped = await creditBalanceQueries.resetRecurringBalancesTx({
				userId: "user-1",
				newPeriodEnd: periodEnd,
			});

			expect(tx.creditBalance.updateMany).toHaveBeenCalledTimes(2);
			expect(tx.creditBalance.updateMany).toHaveBeenLastCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						recurringPeriodEnd: { lt: periodEnd },
					}),
				}),
			);
			// The second (skipped) reset must not write a reset event.
			expect(tx.creditEvent.create).toHaveBeenCalledTimes(1);
			expect(skipped).toEqual([]);
		});

		it("applies the reset when newPeriodEnd is later than the stored periodEnd", async () => {
			const periodEnd = new Date("2026-04-01");
			const balance = makeBalance({
				recurringConsumed: 40,
				recurringPeriodEnd: new Date("2026-03-01"),
			});
			const tx = makeTx({ balances: [balance] });
			await runTx(tx);

			await creditBalanceQueries.resetRecurringBalancesTx({
				userId: "user-1",
				newPeriodEnd: periodEnd,
				newGranted: { ai_tokens: 200 },
			});

			expect(tx.creditBalance.updateMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						id: "b-1",
						OR: [
							{ recurringPeriodEnd: { lt: periodEnd } },
							{
								recurringPeriodEnd: periodEnd,
								recurringGranted: { not: 200 },
							},
						],
					}),
					data: {
						recurringConsumed: 0,
						recurringPeriodEnd: periodEnd,
						recurringGranted: 200,
					},
				}),
			);
			expect(tx.creditEvent.create).toHaveBeenCalledTimes(1);
		});

		it("applies a reset carrying the same periodEnd but a different grant", async () => {
			// Plan-change renewal: equal periodEnd, different newGranted —
			// the grant must not be silently dropped.
			const periodEnd = new Date("2026-03-01");
			const balance = makeBalance({
				recurringGranted: 100,
				recurringConsumed: 10,
				recurringPeriodEnd: periodEnd,
			});
			const tx = makeTx({ balances: [balance] });
			await runTx(tx);

			const result = await creditBalanceQueries.resetRecurringBalancesTx({
				userId: "user-1",
				newPeriodEnd: periodEnd,
				newGranted: { ai_tokens: 300 },
			});

			expect(tx.creditBalance.updateMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						OR: [
							{ recurringPeriodEnd: { lt: periodEnd } },
							{
								recurringPeriodEnd: periodEnd,
								recurringGranted: { not: 300 },
							},
						],
					}),
				}),
			);
			expect(tx.creditEvent.create).toHaveBeenCalledTimes(1);
			expect(result).toEqual([balance]);
		});

		it("skips a redelivered reset with the same periodEnd and the same grant", async () => {
			const periodEnd = new Date("2026-03-01");
			const balance = makeBalance({
				recurringGranted: 300,
				recurringConsumed: 5,
				recurringPeriodEnd: periodEnd,
			});
			const tx = makeTx({ balances: [balance], updateManyCount: 0 });
			await runTx(tx);

			const result = await creditBalanceQueries.resetRecurringBalancesTx({
				userId: "user-1",
				newPeriodEnd: periodEnd,
				newGranted: { ai_tokens: 300 },
			});

			expect(tx.creditEvent.create).not.toHaveBeenCalled();
			expect(result).toEqual([]);
		});

		it("returns only the balances that were actually reset", async () => {
			const b1 = makeBalance({ id: "b-1", meterKey: "ai_tokens" });
			const b2 = makeBalance({ id: "b-2", meterKey: "api_calls" });
			const tx = makeTx({ balances: [b1, b2] });
			tx.creditBalance.updateMany
				.mockResolvedValueOnce({ count: 1 })
				.mockResolvedValueOnce({ count: 0 });
			await runTx(tx);

			const result = await creditBalanceQueries.resetRecurringBalancesTx({
				userId: "user-1",
				newPeriodEnd: new Date("2026-03-01"),
			});

			expect(result).toEqual([b1]);
			expect(tx.creditEvent.create).toHaveBeenCalledTimes(1);
		});
	});

	describe("grantRecurringCreditsTx", () => {
		it("applies the grant and writes an event when the row does not reflect it", async () => {
			const periodEnd = new Date("2026-03-01");
			const tx = makeTx({ balance: makeBalance({ recurringGranted: 100 }) });
			await runTx(tx);

			await creditBalanceQueries.grantRecurringCreditsTx({
				userId: "user-1",
				meterKey: "ai_tokens",
				amount: 200,
				periodEnd,
			});

			expect(tx.creditBalance.updateMany).toHaveBeenCalledWith({
				where: {
					id: "b-1",
					OR: [
						{ recurringGranted: { not: 200 } },
						{ recurringPeriodEnd: { not: periodEnd } },
					],
				},
				data: {
					recurringGranted: 200,
					recurringConsumed: 0,
					recurringPeriodEnd: periodEnd,
				},
			});
			expect(tx.creditEvent.create).toHaveBeenCalledTimes(1);
		});

		it("does not re-zero consumed on a redelivered identical grant", async () => {
			const periodEnd = new Date("2026-03-01");
			const balance = makeBalance({
				recurringGranted: 200,
				recurringConsumed: 40,
				recurringPeriodEnd: periodEnd,
			});
			const tx = makeTx({ balance, updateManyCount: 0 });
			await runTx(tx);

			await creditBalanceQueries.grantRecurringCreditsTx({
				userId: "user-1",
				meterKey: "ai_tokens",
				amount: 200,
				periodEnd,
			});

			// CAS rejected the write → no balance update, no ledger event.
			expect(tx.creditEvent.create).not.toHaveBeenCalled();
		});
	});

	describe("consumeCreditsTx idempotencyKey", () => {
		it("returns the recorded result snapshot verbatim on a dedup hit", async () => {
			// Balance state deliberately disagrees with the snapshot — the
			// replay must return the recorded response, not a recomputed one.
			const balance = makeBalance({ recurringConsumed: 99 });
			const keyedEvent = {
				id: "evt-9",
				metadata: {
					__dedup: { consumed: 80, remaining: 12, source: "overage" },
				},
			};
			const tx = makeTx({ balance, keyedEvent });
			await runTx(tx);

			const result = await creditBalanceQueries.consumeCreditsTx({
				...consumeParams,
				idempotencyKey: "req-123",
			});

			expect(result).toEqual({
				ok: true,
				consumed: 80,
				remaining: 12,
				source: "overage",
				deduplicated: true,
			});
			expect(tx.creditBalance.updateMany).not.toHaveBeenCalled();
			expect(tx.creditPackage.updateMany).not.toHaveBeenCalled();
			expect(tx.creditEvent.create).not.toHaveBeenCalled();
		});

		it("throws when the keyed event has no usable snapshot", async () => {
			const tx = makeTx({
				balance: makeBalance(),
				keyedEvent: { id: "evt-1", metadata: null },
			});
			await runTx(tx);

			await expect(
				creditBalanceQueries.consumeCreditsTx({
					...consumeParams,
					idempotencyKey: "req-123",
				}),
			).rejects.toThrow(/snapshot/);
			expect(tx.creditBalance.updateMany).not.toHaveBeenCalled();
			expect(tx.creditEvent.create).not.toHaveBeenCalled();
		});

		it("writes the idempotencyKey on exactly one event of a multi-source consume", async () => {
			// recurringRemaining 10 + topup 40 → two events; only the first
			// carries the key or a second keyed insert would self-violate.
			const balance = makeBalance({ recurringConsumed: 90 });
			const pkg = {
				id: "pkg-1",
				userId: "user-1",
				organizationId: null,
				meterKey: "ai_tokens",
				amount: 100,
				consumed: 0,
				expiresAt: null,
				priority: 10,
			};
			const tx = makeTx({ balance, packages: [pkg] });
			let n = 0;
			tx.creditEvent.create.mockImplementation(
				async () => ({ id: `evt-${++n}` }) as never,
			);
			await runTx(tx);

			const result = await creditBalanceQueries.consumeCreditsTx({
				...consumeParams,
				metadata: { requestId: "r-1" },
				idempotencyKey: "req-multi",
			});

			expect(result).toMatchObject({
				ok: true,
				consumed: 50,
				remaining: 60,
				source: "topup",
			});
			const eventData = tx.creditEvent.create.mock.calls.map(
				([arg]) => (arg as { data: Record<string, unknown> }).data,
			);
			expect(eventData).toHaveLength(2);
			expect(eventData[0]).toMatchObject({
				source: "recurring",
				idempotencyKey: "req-multi",
			});
			expect(eventData[1]).toMatchObject({
				source: "topup",
				idempotencyKey: null,
			});
			// The keyed event records the full result snapshot inside the tx.
			expect(tx.creditEvent.update).toHaveBeenCalledTimes(1);
			expect(tx.creditEvent.update).toHaveBeenCalledWith({
				where: { id: "evt-1" },
				data: {
					metadata: {
						requestId: "r-1",
						__dedup: { consumed: 50, remaining: 60, source: "topup" },
					},
				},
			});
		});

		it("treats a P2002 on the idempotency index as a dedup hit (concurrent duplicate)", async () => {
			const tx = makeTx({ balance: makeBalance() });
			tx.creditEvent.create.mockRejectedValue(
				makeP2002(["userId", "meterKey", "idempotencyKey"]),
			);
			await runTx(tx);

			vi.mocked(db.creditEvent.findFirst).mockResolvedValue({
				id: "evt-w",
				metadata: {
					__dedup: { consumed: 50, remaining: 50, source: "recurring" },
				},
			} as never);

			const result = await creditBalanceQueries.consumeCreditsTx({
				...consumeParams,
				idempotencyKey: "req-123",
			});

			expect(result).toEqual({
				ok: true,
				consumed: 50,
				remaining: 50,
				source: "recurring",
				deduplicated: true,
			});
			// The rolled-back tx must not be retried as a first-touch race.
			expect(db.$transaction).toHaveBeenCalledTimes(1);
		});

		it("treats a P2002 naming the org idempotency index as a dedup hit", async () => {
			const balance = makeBalance({
				userId: null,
				organizationId: "org-1",
			});
			const tx = makeTx({ balance });
			tx.creditEvent.create.mockRejectedValue(
				makeP2002OnConstraint("credit_event_organization_idempotency_key"),
			);
			await runTx(tx);

			vi.mocked(db.creditEvent.findFirst).mockResolvedValue({
				id: "evt-w",
				metadata: {
					__dedup: { consumed: 50, remaining: 50, source: "recurring" },
				},
			} as never);

			const result = await creditBalanceQueries.consumeCreditsTx({
				organizationId: "org-1",
				meterKey: "ai_tokens",
				amount: 50,
				reason: "test",
				allowOverage: false,
				idempotencyKey: "req-123",
			});

			expect(result).toMatchObject({ ok: true, deduplicated: true });
		});

		it("throws when a dedup conflict has no committed winner event", async () => {
			const tx = makeTx({ balance: makeBalance() });
			tx.creditEvent.create.mockRejectedValue(
				makeP2002(["userId", "meterKey", "idempotencyKey"]),
			);
			await runTx(tx);
			vi.mocked(db.creditEvent.findFirst).mockResolvedValue(null);

			await expect(
				creditBalanceQueries.consumeCreditsTx({
					...consumeParams,
					idempotencyKey: "req-123",
				}),
			).rejects.toThrow(/snapshot/);
		});

		it("writes the key and result snapshot for a single-source consume", async () => {
			const balance = makeBalance();
			const tx = makeTx({ balance });
			await runTx(tx);

			const result = await creditBalanceQueries.consumeCreditsTx({
				...consumeParams,
				idempotencyKey: "req-123",
			});

			expect(result).toMatchObject({
				ok: true,
				consumed: 50,
				remaining: 50,
				source: "recurring",
			});
			expect(result.deduplicated).toBeUndefined();
			expect(tx.creditEvent.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ idempotencyKey: "req-123" }),
				}),
			);
			expect(tx.creditEvent.update).toHaveBeenCalledWith({
				where: { id: "evt-1" },
				data: {
					metadata: {
						__dedup: { consumed: 50, remaining: 50, source: "recurring" },
					},
				},
			});
		});

		it("still consumes normally without an idempotencyKey", async () => {
			const balance = makeBalance();
			const tx = makeTx({ balance });
			await runTx(tx);

			const result = await creditBalanceQueries.consumeCreditsTx(consumeParams);

			expect(result).toMatchObject({ ok: true, consumed: 50 });
			expect(result.deduplicated).toBeUndefined();
			expect(tx.creditEvent.findFirst).not.toHaveBeenCalled();
			expect(tx.creditEvent.update).not.toHaveBeenCalled();
			expect(tx.creditEvent.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ idempotencyKey: null }),
				}),
			);
		});

		it("rethrows a P2002 that did not come from the idempotency index", async () => {
			const balance = makeBalance();
			const tx = makeTx({ balance });
			tx.creditEvent.create.mockRejectedValue(makeP2002(["someOtherColumn"]));
			await runTx(tx);

			await expect(
				creditBalanceQueries.consumeCreditsTx({
					...consumeParams,
					idempotencyKey: "req-123",
				}),
			).rejects.toThrow("Unique constraint failed");
		});
	});
});
