import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/db", () => ({
	getCreditBalancesForUser: vi.fn(),
	getCreditBalancesForOrganization: vi.fn(),
	resetRecurringBalancesTx: vi.fn(),
}));

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	}),
}));

import {
	getCreditBalancesForOrganization,
	getCreditBalancesForUser,
	resetRecurringBalancesTx,
} from "@fuutu/db";
import { resetRecurringCredits } from "../reset";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("resetRecurringCredits", () => {
	it("fetches balances for user when userId is set", async () => {
		vi.mocked(getCreditBalancesForUser).mockResolvedValue([]);
		vi.mocked(resetRecurringBalancesTx).mockResolvedValue(undefined);
		const newPeriodEnd = new Date("2026-12-31");

		await resetRecurringCredits({ userId: "user-1", newPeriodEnd });

		expect(getCreditBalancesForUser).toHaveBeenCalledWith("user-1");
		expect(getCreditBalancesForOrganization).not.toHaveBeenCalled();
	});

	it("fetches balances for org when only organizationId is set", async () => {
		vi.mocked(getCreditBalancesForOrganization).mockResolvedValue([]);
		vi.mocked(resetRecurringBalancesTx).mockResolvedValue(undefined);
		const newPeriodEnd = new Date("2026-12-31");

		await resetRecurringCredits({ organizationId: "org-1", newPeriodEnd });

		expect(getCreditBalancesForOrganization).toHaveBeenCalledWith("org-1");
		expect(getCreditBalancesForUser).not.toHaveBeenCalled();
	});

	it("passes balances + params to resetRecurringBalancesTx", async () => {
		const balances = [
			{
				id: "b-1",
				meterKey: "ai_tokens",
				recurringGranted: 500,
				recurringConsumed: 500,
			},
			{
				id: "b-2",
				meterKey: "api_calls",
				recurringGranted: 1000,
				recurringConsumed: 200,
			},
		];
		vi.mocked(getCreditBalancesForUser).mockResolvedValue(balances as never);
		vi.mocked(resetRecurringBalancesTx).mockResolvedValue(undefined);
		const newPeriodEnd = new Date("2026-12-31");

		await resetRecurringCredits({ userId: "user-1", newPeriodEnd });

		expect(resetRecurringBalancesTx).toHaveBeenCalledWith({
			balances,
			userId: "user-1",
			organizationId: undefined,
			newPeriodEnd,
			newGranted: undefined,
		});
	});

	it("passes newGranted map through when plan changed", async () => {
		vi.mocked(getCreditBalancesForUser).mockResolvedValue([]);
		vi.mocked(resetRecurringBalancesTx).mockResolvedValue(undefined);
		const newPeriodEnd = new Date("2026-12-31");
		const newGranted = { ai_tokens: 1_000_000, api_calls: 100_000 };

		await resetRecurringCredits({ userId: "user-1", newPeriodEnd, newGranted });

		expect(resetRecurringBalancesTx).toHaveBeenCalledWith(
			expect.objectContaining({ newGranted }),
		);
	});

	it("rejects non-positive amounts in newGranted map", async () => {
		await expect(
			resetRecurringCredits({
				userId: "user-1",
				newPeriodEnd: new Date(),
				newGranted: { ai_tokens: 0 },
			}),
		).rejects.toThrow();
	});

	it("rejects non-integer amounts in newGranted map", async () => {
		await expect(
			resetRecurringCredits({
				userId: "user-1",
				newPeriodEnd: new Date(),
				newGranted: { ai_tokens: 1.5 },
			}),
		).rejects.toThrow();
	});

	it("rejects missing newPeriodEnd", async () => {
		await expect(
			resetRecurringCredits({
				userId: "user-1",
				newPeriodEnd: "2026-12-31" as unknown as Date,
			}),
		).rejects.toThrow();
	});

	it("propagates tx errors", async () => {
		vi.mocked(getCreditBalancesForUser).mockResolvedValue([]);
		vi.mocked(resetRecurringBalancesTx).mockRejectedValue(new Error("db down"));

		await expect(
			resetRecurringCredits({ userId: "user-1", newPeriodEnd: new Date() }),
		).rejects.toThrow("db down");
	});
});
