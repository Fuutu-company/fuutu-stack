import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/db", () => ({
	resetRecurringBalancesTx: vi.fn(),
}));

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	}),
}));

import { resetRecurringBalancesTx } from "@fuutu/db";
import { resetRecurringCredits } from "../reset";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("resetRecurringCredits", () => {
	it("delegates to resetRecurringBalancesTx for a user owner", async () => {
		vi.mocked(resetRecurringBalancesTx).mockResolvedValue([]);
		const newPeriodEnd = new Date("2026-12-31");

		await resetRecurringCredits({ userId: "user-1", newPeriodEnd });

		expect(resetRecurringBalancesTx).toHaveBeenCalledWith({
			userId: "user-1",
			organizationId: undefined,
			newPeriodEnd,
			newGranted: undefined,
		});
	});

	it("delegates to resetRecurringBalancesTx for an org owner", async () => {
		vi.mocked(resetRecurringBalancesTx).mockResolvedValue([]);
		const newPeriodEnd = new Date("2026-12-31");

		await resetRecurringCredits({ organizationId: "org-1", newPeriodEnd });

		expect(resetRecurringBalancesTx).toHaveBeenCalledWith(
			expect.objectContaining({
				organizationId: "org-1",
				userId: undefined,
			}),
		);
	});

	it("passes newGranted map through when plan changed", async () => {
		vi.mocked(resetRecurringBalancesTx).mockResolvedValue([]);
		const newPeriodEnd = new Date("2026-12-31");
		const newGranted = { ai_tokens: 1_000_000, api_calls: 100_000 };

		await resetRecurringCredits({ userId: "user-1", newPeriodEnd, newGranted });

		expect(resetRecurringBalancesTx).toHaveBeenCalledWith(
			expect.objectContaining({ newGranted }),
		);
	});

	it("rejects when both userId and organizationId are set (owner XOR)", async () => {
		await expect(
			resetRecurringCredits({
				userId: "user-1",
				organizationId: "org-1",
				newPeriodEnd: new Date(),
			}),
		).rejects.toThrow();
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
		vi.mocked(resetRecurringBalancesTx).mockRejectedValue(new Error("db down"));

		await expect(
			resetRecurringCredits({ userId: "user-1", newPeriodEnd: new Date() }),
		).rejects.toThrow("db down");
	});
});
