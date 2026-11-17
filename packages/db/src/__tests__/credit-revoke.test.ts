import { beforeEach, describe, expect, it, vi } from "vitest";

// Revocation after a refund, dispute or an unpaid trial end: the unused
// rest of a grant goes, what was already consumed stays consumed.

vi.mock("../../prisma/client", () => ({
	db: { $transaction: vi.fn() },
}));

import { db } from "../../prisma/client";
import {
	revokeCreditPackageForPurchaseTx,
	revokeRecurringBalancesTx,
} from "../../prisma/queries/credit-balance";

const balance = (overrides: Record<string, unknown> = {}) => ({
	id: "b-1",
	userId: null,
	organizationId: "org-1",
	meterKey: "ai_tokens",
	recurringGranted: 500,
	recurringConsumed: 120,
	recurringPeriodEnd: new Date("2026-12-01"),
	...overrides,
});

function makeTx(opts: {
	balances?: unknown[];
	reread?: unknown;
	updateCounts?: number[];
	creditPackage?: unknown;
}) {
	const counts = [...(opts.updateCounts ?? [])];
	return {
		creditBalance: {
			findMany: vi.fn().mockResolvedValue(opts.balances ?? []),
			findUnique: vi.fn().mockResolvedValue(opts.reread ?? null),
			updateMany: vi
				.fn()
				.mockImplementation(async () => ({ count: counts.shift() ?? 1 })),
		},
		creditPackage: {
			findFirst: vi.fn().mockResolvedValue(opts.creditPackage ?? null),
			update: vi.fn().mockResolvedValue({}),
		},
		creditEvent: { create: vi.fn().mockResolvedValue({ id: "evt-1" }) },
	};
}

function runTx(tx: unknown) {
	vi.mocked(db.$transaction).mockImplementation(
		async (callback) => (await callback(tx as never)) as never,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("revokeRecurringBalancesTx", () => {
	it("drops the granted amount to what is consumed and records the revoked rest", async () => {
		const tx = makeTx({ balances: [balance()] });
		runTx(tx);

		const revoked = await revokeRecurringBalancesTx({
			organizationId: "org-1",
			reason: "payment_reversed",
		});

		expect(tx.creditBalance.findMany).toHaveBeenCalledWith({
			where: { userId: null, organizationId: "org-1" },
		});
		expect(tx.creditBalance.updateMany).toHaveBeenCalledWith({
			where: { id: "b-1", recurringGranted: 500, recurringConsumed: 120 },
			data: { recurringGranted: 120 },
		});
		expect(tx.creditEvent.create).toHaveBeenCalledWith({
			data: {
				userId: null,
				organizationId: "org-1",
				meterKey: "ai_tokens",
				amount: 380,
				source: "reset",
				reason: "payment_reversed",
			},
		});
		expect(revoked).toBe(1);
	});

	it("skips a balance with nothing left (a redelivery is a no-op)", async () => {
		const tx = makeTx({
			balances: [balance({ recurringGranted: 120, recurringConsumed: 120 })],
		});
		runTx(tx);

		const revoked = await revokeRecurringBalancesTx({
			organizationId: "org-1",
			reason: "payment_reversed",
		});

		expect(tx.creditBalance.updateMany).not.toHaveBeenCalled();
		expect(tx.creditEvent.create).not.toHaveBeenCalled();
		expect(revoked).toBe(0);
	});

	it("re-reads and retries when a concurrent consume moved the row", async () => {
		const tx = makeTx({
			balances: [balance()],
			reread: balance({ recurringConsumed: 150 }),
			updateCounts: [0, 1],
		});
		runTx(tx);

		await revokeRecurringBalancesTx({
			organizationId: "org-1",
			reason: "payment_reversed",
		});

		expect(tx.creditBalance.updateMany).toHaveBeenLastCalledWith({
			where: { id: "b-1", recurringGranted: 500, recurringConsumed: 150 },
			data: { recurringGranted: 150 },
		});
		expect(tx.creditEvent.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ amount: 350 }),
			}),
		);
	});

	it("throws when the row keeps moving, so the webhook is retried", async () => {
		const tx = makeTx({
			balances: [balance()],
			reread: balance(),
			updateCounts: [0, 0, 0],
		});
		runTx(tx);

		await expect(
			revokeRecurringBalancesTx({
				organizationId: "org-1",
				reason: "payment_reversed",
			}),
		).rejects.toThrow();
	});

	it("refuses an owner that is not exactly one of user or organization", async () => {
		await expect(
			revokeRecurringBalancesTx({
				userId: "u",
				organizationId: "o",
				reason: "x",
			}),
		).rejects.toThrow();
		await expect(revokeRecurringBalancesTx({ reason: "x" })).rejects.toThrow();
	});
});

describe("revokeCreditPackageForPurchaseTx", () => {
	it("expires the purchase's package now and records the unused rest", async () => {
		const tx = makeTx({
			creditPackage: {
				id: "pkg-1",
				userId: "user-1",
				organizationId: null,
				meterKey: "ai_tokens",
				amount: 100_000,
				consumed: 30_000,
				expiresAt: null,
			},
		});
		runTx(tx);

		const before = Date.now();
		const revoked = await revokeCreditPackageForPurchaseTx(
			"purchase-1",
			"payment_reversed",
		);

		expect(tx.creditPackage.findFirst).toHaveBeenCalledWith({
			where: { purchaseId: "purchase-1" },
		});
		const update = tx.creditPackage.update.mock.calls[0]?.[0] as {
			where: { id: string };
			data: { expiresAt: Date };
		};
		expect(update.where).toEqual({ id: "pkg-1" });
		expect(update.data.expiresAt.getTime()).toBeGreaterThanOrEqual(before);
		expect(update.data.expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
		expect(tx.creditEvent.create).toHaveBeenCalledWith({
			data: {
				userId: "user-1",
				organizationId: null,
				meterKey: "ai_tokens",
				amount: 70_000,
				source: "reset",
				reason: "payment_reversed",
				packageId: "pkg-1",
			},
		});
		expect(revoked).toBe(true);
	});

	it("is a no-op for an already expired package or a purchase without one", async () => {
		runTx(
			makeTx({
				creditPackage: {
					id: "pkg-1",
					amount: 10,
					consumed: 0,
					expiresAt: new Date(Date.now() - 1000),
				},
			}),
		);
		await expect(
			revokeCreditPackageForPurchaseTx("purchase-1", "payment_reversed"),
		).resolves.toBe(false);

		runTx(makeTx({}));
		await expect(
			revokeCreditPackageForPurchaseTx("purchase-2", "payment_reversed"),
		).resolves.toBe(false);
	});
});
