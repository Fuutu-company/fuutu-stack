import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/db", () => ({
	revokeRecurringBalancesTx: vi.fn(),
	revokeCreditPackageForPurchaseTx: vi.fn(),
}));

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	}),
}));

import {
	revokeCreditPackageForPurchaseTx,
	revokeRecurringBalancesTx,
} from "@fuutu/db";
import { revokeRecurringCredits, revokeTopUpCredits } from "../revoke";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("revokeRecurringCredits", () => {
	it("revokes the unused recurring credits of an org owner", async () => {
		vi.mocked(revokeRecurringBalancesTx).mockResolvedValue(2);

		await revokeRecurringCredits({
			organizationId: "org-1",
			reason: "payment_reversed",
		});

		expect(revokeRecurringBalancesTx).toHaveBeenCalledWith({
			userId: undefined,
			organizationId: "org-1",
			reason: "payment_reversed",
		});
	});

	it("rejects both or neither owner before touching the DB", async () => {
		await expect(
			revokeRecurringCredits({
				userId: "u",
				organizationId: "o",
				reason: "x",
			}),
		).rejects.toThrow();
		await expect(revokeRecurringCredits({ reason: "x" })).rejects.toThrow();
		expect(revokeRecurringBalancesTx).not.toHaveBeenCalled();
	});
});

describe("revokeTopUpCredits", () => {
	it("revokes the package of the purchase", async () => {
		vi.mocked(revokeCreditPackageForPurchaseTx).mockResolvedValue(true);

		await expect(
			revokeTopUpCredits({ purchaseId: "p-1", reason: "payment_reversed" }),
		).resolves.toBe(true);
		expect(revokeCreditPackageForPurchaseTx).toHaveBeenCalledWith(
			"p-1",
			"payment_reversed",
		);
	});
});
