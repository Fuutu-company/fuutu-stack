import { describe, expect, it, vi } from "vitest";

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
			create: vi.fn(),
		},
		creditEvent: {
			create: vi.fn(),
		},
	},
}));

import * as creditBalanceQueries from "../../prisma/queries/credit-balance";

describe("credit-balance queries - concurrency safety", () => {
	describe("consumeCreditsTx", () => {
		it("uses conditional updateMany for recurring credits to prevent double-spend", async () => {
			const mockTx = {
				creditBalance: {
					findFirst: vi.fn(),
					create: vi.fn(),
					updateMany: vi.fn(),
					update: vi.fn(),
				},
				creditPackage: {
					findMany: vi.fn(),
					update: vi.fn(),
				},
				creditEvent: {
					create: vi.fn(),
				},
			};

			const mockBalance = {
				id: "balance-1",
				userId: "user-1",
				meterKey: "ai_tokens",
				recurringGranted: 100,
				recurringConsumed: 0,
				recurringPeriodEnd: new Date(),
			};

			mockTx.creditBalance.findFirst.mockResolvedValue(mockBalance);
			mockTx.creditBalance.updateMany.mockResolvedValue({ count: 1 });
			mockTx.creditEvent.create.mockResolvedValue({ id: "event-1" });
			mockTx.creditPackage.findMany.mockResolvedValue([]);

			const { db } = await import("../../prisma/client");
			vi.mocked(db.$transaction).mockImplementation(async (callback) => {
				return callback(mockTx as never);
			});

			const _result = await creditBalanceQueries.consumeCreditsTx({
				userId: "user-1",
				meterKey: "ai_tokens",
				amount: 50,
				reason: "test",
				allowOverage: false,
			});

			expect(mockTx.creditBalance.updateMany).toHaveBeenCalledWith({
				where: {
					id: "balance-1",
					recurringConsumed: { lte: 50 }, // recurringGranted - fromRecurring (100 - 50)
				},
				data: { recurringConsumed: { increment: 50 } },
			});
		});

		it("throws when conditional updateMany fails (concurrent consume detected)", async () => {
			const mockTx = {
				creditBalance: {
					findFirst: vi.fn(),
					create: vi.fn(),
					updateMany: vi.fn(),
					update: vi.fn(),
				},
				creditPackage: {
					findMany: vi.fn(),
					update: vi.fn(),
				},
				creditEvent: {
					create: vi.fn(),
				},
			};

			const mockBalance = {
				id: "balance-1",
				userId: "user-1",
				meterKey: "ai_tokens",
				recurringGranted: 100,
				recurringConsumed: 0,
				recurringPeriodEnd: new Date(),
			};

			mockTx.creditBalance.findFirst.mockResolvedValue(mockBalance);
			mockTx.creditBalance.updateMany.mockResolvedValue({ count: 0 }); // No rows updated

			const { db } = await import("../../prisma/client");
			vi.mocked(db.$transaction).mockImplementation(async (callback) => {
				return callback(mockTx as never);
			});

			await expect(
				creditBalanceQueries.consumeCreditsTx({
					userId: "user-1",
					meterKey: "ai_tokens",
					amount: 50,
					reason: "test",
					allowOverage: false,
				}),
			).rejects.toThrow("Insufficient credits (concurrent consume)");
		});
	});

	describe("grantRecurringCreditsTx", () => {
		it("uses conditional updateMany to prevent race with concurrent consume", async () => {
			const mockTx = {
				creditBalance: {
					findFirst: vi.fn(),
					create: vi.fn(),
					updateMany: vi.fn(),
					update: vi.fn(),
				},
				creditEvent: {
					create: vi.fn(),
				},
			};

			const mockBalance = {
				id: "balance-1",
				userId: "user-1",
				meterKey: "ai_tokens",
				recurringGranted: 100,
				recurringConsumed: 50,
				recurringPeriodEnd: new Date(),
			};

			mockTx.creditBalance.findFirst.mockResolvedValue(mockBalance);
			mockTx.creditBalance.updateMany.mockResolvedValue({ count: 1 });
			mockTx.creditEvent.create.mockResolvedValue({ id: "event-1" });

			const { db } = await import("../../prisma/client");
			vi.mocked(db.$transaction).mockImplementation(async (callback) => {
				return callback(mockTx as never);
			});

			await creditBalanceQueries.grantRecurringCreditsTx({
				userId: "user-1",
				meterKey: "ai_tokens",
				amount: 200,
				periodEnd: new Date("2025-01-01"),
			});

			expect(mockTx.creditBalance.updateMany).toHaveBeenCalledWith({
				where: { id: "balance-1" },
				data: {
					recurringGranted: 200,
					recurringConsumed: 0,
					recurringPeriodEnd: new Date("2025-01-01"),
				},
			});
		});
	});
});
