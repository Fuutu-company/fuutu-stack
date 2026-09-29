import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../prisma/client", () => ({
	db: {
		$transaction: vi.fn(),
		creditBalance: {
			findFirst: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn(),
		},
		creditPackage: {
			findMany: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn(),
			create: vi.fn(),
		},
		creditEvent: {
			create: vi.fn(),
		},
	},
}));

import { db } from "../../prisma/client";
import * as creditBalanceQueries from "../../prisma/queries/credit-balance";
import * as creditPackageQueries from "../../prisma/queries/credit-package";

function makeP2002(): Error {
	return Object.assign(new Error("Unique constraint failed"), {
		code: "P2002",
	});
}

function makeTx(overrides: {
	balance?: unknown;
	packages?: unknown[];
	updateManyCount?: number;
}) {
	return {
		creditBalance: {
			findFirst: vi.fn().mockResolvedValue(overrides.balance ?? null),
			create: vi.fn().mockResolvedValue(overrides.balance ?? { id: "b-new" }),
			update: vi.fn(),
			updateMany: vi
				.fn()
				.mockResolvedValue({ count: overrides.updateManyCount ?? 1 }),
		},
		creditPackage: {
			findMany: vi.fn().mockResolvedValue(overrides.packages ?? []),
			update: vi.fn(),
			updateMany: vi
				.fn()
				.mockResolvedValue({ count: overrides.updateManyCount ?? 1 }),
		},
		creditEvent: {
			create: vi.fn().mockResolvedValue({ id: "evt-1" }),
		},
	};
}

async function runTx(tx: unknown) {
	vi.mocked(db.$transaction).mockImplementation(
		async (callback) => (await callback(tx as never)) as never,
	);
}

describe("credit owner isolation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getActiveCreditPackages", () => {
		it("ANDs owner columns — a user query must not match org-owned or other-user packages", async () => {
			vi.mocked(db.creditPackage.findMany).mockResolvedValue([] as never);

			await creditPackageQueries.getActiveCreditPackages({
				userId: "user-1",
				meterKey: "ai_tokens",
			});

			const where = vi.mocked(db.creditPackage.findMany).mock.calls[0]?.[0]
				?.where as Record<string, unknown>;
			const ownerClause = (where.AND as Record<string, unknown>[])[0];
			// AND semantics: user-owned rows only — never org-owned rows of
			// other tenants, never rows where userId differs.
			expect(ownerClause).toEqual({
				userId: "user-1",
				organizationId: null,
			});
		});

		it("ANDs owner columns for org queries — user-owned packages never match", async () => {
			vi.mocked(db.creditPackage.findMany).mockResolvedValue([] as never);

			await creditPackageQueries.getActiveCreditPackages({
				organizationId: "org-1",
				meterKey: "ai_tokens",
			});

			const where = vi.mocked(db.creditPackage.findMany).mock.calls[0]?.[0]
				?.where as Record<string, unknown>;
			const ownerClause = (where.AND as Record<string, unknown>[])[0];
			expect(ownerClause).toEqual({
				userId: null,
				organizationId: "org-1",
			});
		});
	});

	describe("getCreditBalance", () => {
		it("queries a single owner — org-owned rows are excluded from user lookups", async () => {
			vi.mocked(db.creditBalance.findFirst).mockResolvedValue(null);

			await creditBalanceQueries.getCreditBalance({
				userId: "user-1",
				meterKey: "ai_tokens",
			});

			expect(db.creditBalance.findFirst).toHaveBeenCalledWith({
				where: {
					userId: "user-1",
					organizationId: null,
					meterKey: "ai_tokens",
				},
			});
		});
	});

	describe("consumeCreditsTx", () => {
		it("scopes the top-up package lookup to exactly one owner (no cross-owner leak)", async () => {
			const balance = {
				id: "b-1",
				userId: "user-1",
				organizationId: null,
				meterKey: "ai_tokens",
				recurringGranted: 100,
				recurringConsumed: 0,
				recurringPeriodEnd: new Date(),
			};
			const tx = makeTx({ balance, packages: [] });
			await runTx(tx);

			await creditBalanceQueries.consumeCreditsTx({
				userId: "user-1",
				meterKey: "ai_tokens",
				amount: 50,
				reason: "test",
				allowOverage: false,
			});

			const where = tx.creditPackage.findMany.mock.calls[0]?.[0]
				?.where as Record<string, unknown>;
			const ownerClause = (where.AND as Record<string, unknown>[])[0];
			expect(ownerClause).toEqual({
				userId: "user-1",
				organizationId: null,
			});
		});

		it("returns ok:false WITHOUT writing anything when credits are insufficient", async () => {
			const balance = {
				id: "b-1",
				userId: "user-1",
				organizationId: null,
				meterKey: "ai_tokens",
				recurringGranted: 10,
				recurringConsumed: 0,
				recurringPeriodEnd: new Date(),
			};
			const tx = makeTx({ balance, packages: [] });
			await runTx(tx);

			const result = await creditBalanceQueries.consumeCreditsTx({
				userId: "user-1",
				meterKey: "ai_tokens",
				amount: 50,
				reason: "test",
				allowOverage: false,
			});

			expect(result.ok).toBe(false);
			expect(result.consumed).toBe(0);
			// No partial debit: balance/package mutations and credit events
			// must not have been written.
			expect(tx.creditBalance.updateMany).not.toHaveBeenCalled();
			expect(tx.creditBalance.update).not.toHaveBeenCalled();
			expect(tx.creditPackage.updateMany).not.toHaveBeenCalled();
			expect(tx.creditEvent.create).not.toHaveBeenCalled();
		});

		it("does not partially debit top-up packages when total is insufficient", async () => {
			const balance = {
				id: "b-1",
				userId: "user-1",
				organizationId: null,
				meterKey: "ai_tokens",
				recurringGranted: 10,
				recurringConsumed: 0,
				recurringPeriodEnd: new Date(),
			};
			const pkg = {
				id: "pkg-1",
				userId: "user-1",
				organizationId: null,
				meterKey: "ai_tokens",
				amount: 30,
				consumed: 0,
				expiresAt: null,
				priority: 10,
				createdAt: new Date(),
			};
			const tx = makeTx({ balance, packages: [pkg] });
			await runTx(tx);

			const result = await creditBalanceQueries.consumeCreditsTx({
				userId: "user-1",
				meterKey: "ai_tokens",
				amount: 50,
				reason: "test",
				allowOverage: false,
			});

			expect(result).toMatchObject({
				ok: false,
				consumed: 0,
				remaining: 40,
				error: "credits_exceeded",
			});
			expect(tx.creditBalance.updateMany).not.toHaveBeenCalled();
			expect(tx.creditPackage.updateMany).not.toHaveBeenCalled();
			expect(tx.creditEvent.create).not.toHaveBeenCalled();
		});

		it("still consumes fully when credits are sufficient", async () => {
			const balance = {
				id: "b-1",
				userId: "user-1",
				organizationId: null,
				meterKey: "ai_tokens",
				recurringGranted: 100,
				recurringConsumed: 0,
				recurringPeriodEnd: new Date(),
			};
			const tx = makeTx({ balance, packages: [] });
			await runTx(tx);

			const result = await creditBalanceQueries.consumeCreditsTx({
				userId: "user-1",
				meterKey: "ai_tokens",
				amount: 50,
				reason: "test",
				allowOverage: false,
			});

			expect(result).toMatchObject({ ok: true, consumed: 50 });
			expect(tx.creditBalance.updateMany).toHaveBeenCalledOnce();
			expect(tx.creditEvent.create).toHaveBeenCalledOnce();
		});
	});

	describe("upsertCreditBalance", () => {
		it("retries the find-then-create on P2002 (concurrent first-touch)", async () => {
			const existing = {
				id: "b-1",
				userId: "user-1",
				organizationId: null,
				meterKey: "ai_tokens",
				recurringGranted: 10,
				recurringConsumed: 0,
				recurringPeriodEnd: new Date(),
			};
			vi.mocked(db.creditBalance.findFirst)
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce(existing as never);
			vi.mocked(db.creditBalance.create).mockRejectedValueOnce(makeP2002());
			vi.mocked(db.creditBalance.update).mockResolvedValue(existing as never);

			const result = await creditBalanceQueries.upsertCreditBalance({
				userId: "user-1",
				meterKey: "ai_tokens",
				recurringGranted: 100,
			});

			expect(result.id).toBe("b-1");
			expect(db.creditBalance.findFirst).toHaveBeenCalledTimes(2);
			expect(db.creditBalance.update).toHaveBeenCalledWith(
				expect.objectContaining({ where: { id: "b-1" } }),
			);
		});
	});

	describe("grantRecurringCreditsTx", () => {
		it("retries the whole transaction on P2002 from the create path", async () => {
			const existing = {
				id: "b-1",
				userId: "user-1",
				organizationId: null,
				meterKey: "ai_tokens",
				recurringGranted: 0,
				recurringConsumed: 0,
				recurringPeriodEnd: new Date(),
			};
			const txFail = makeTx({ balance: null });
			txFail.creditBalance.create.mockRejectedValueOnce(makeP2002());
			const txOk = makeTx({ balance: existing });

			vi.mocked(db.$transaction)
				.mockImplementationOnce(
					async (callback) => (await callback(txFail as never)) as never,
				)
				.mockImplementationOnce(
					async (callback) => (await callback(txOk as never)) as never,
				);

			await creditBalanceQueries.grantRecurringCreditsTx({
				userId: "user-1",
				meterKey: "ai_tokens",
				amount: 200,
				periodEnd: new Date("2025-01-01"),
			});

			expect(db.$transaction).toHaveBeenCalledTimes(2);
			expect(txOk.creditBalance.updateMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: "b-1" },
					data: expect.objectContaining({ recurringGranted: 200 }),
				}),
			);
		});
	});
});
