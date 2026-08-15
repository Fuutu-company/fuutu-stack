import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/db", () => ({
	grantRecurringCreditsTx: vi.fn(),
	grantTopUpCreditsTx: vi.fn(),
}));

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	}),
}));

import { grantRecurringCreditsTx, grantTopUpCreditsTx } from "@fuutu/db";
import { grantRecurringCredits, grantTopUpCredits } from "../grant";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("grantRecurringCredits", () => {
	it("calls grantRecurringCreditsTx with parsed params", async () => {
		vi.mocked(grantRecurringCreditsTx).mockResolvedValue(undefined);
		const periodEnd = new Date("2026-12-31");

		await grantRecurringCredits({
			userId: "user-1",
			meterKey: "ai_tokens",
			amount: 500_000,
			periodEnd,
		});

		expect(grantRecurringCreditsTx).toHaveBeenCalledWith({
			userId: "user-1",
			organizationId: undefined,
			meterKey: "ai_tokens",
			amount: 500_000,
			periodEnd,
		});
	});

	it("works with organizationId", async () => {
		vi.mocked(grantRecurringCreditsTx).mockResolvedValue(undefined);
		const periodEnd = new Date("2026-12-31");

		await grantRecurringCredits({
			organizationId: "org-1",
			meterKey: "api_calls",
			amount: 50_000,
			periodEnd,
		});

		expect(grantRecurringCreditsTx).toHaveBeenCalledWith(
			expect.objectContaining({ organizationId: "org-1", userId: undefined }),
		);
	});

	it("rejects non-positive amount", async () => {
		await expect(
			grantRecurringCredits({
				userId: "user-1",
				meterKey: "ai_tokens",
				amount: 0,
				periodEnd: new Date(),
			}),
		).rejects.toThrow();
	});

	it("rejects non-integer amount", async () => {
		await expect(
			grantRecurringCredits({
				userId: "user-1",
				meterKey: "ai_tokens",
				amount: 1.5,
				periodEnd: new Date(),
			}),
		).rejects.toThrow();
	});

	it("rejects missing periodEnd", async () => {
		await expect(
			grantRecurringCredits({
				userId: "user-1",
				meterKey: "ai_tokens",
				amount: 100,
				periodEnd: "2026-12-31" as unknown as Date,
			}),
		).rejects.toThrow();
	});

	it("propagates tx errors", async () => {
		vi.mocked(grantRecurringCreditsTx).mockRejectedValue(new Error("db down"));

		await expect(
			grantRecurringCredits({
				userId: "user-1",
				meterKey: "ai_tokens",
				amount: 100,
				periodEnd: new Date(),
			}),
		).rejects.toThrow("db down");
	});
});

describe("grantTopUpCredits", () => {
	it("calls grantTopUpCreditsTx with parsed params and defaults", async () => {
		vi.mocked(grantTopUpCreditsTx).mockResolvedValue(undefined);

		await grantTopUpCredits({
			userId: "user-1",
			meterKey: "ai_tokens",
			amount: 10_000,
		});

		expect(grantTopUpCreditsTx).toHaveBeenCalledWith({
			userId: "user-1",
			organizationId: undefined,
			meterKey: "ai_tokens",
			amount: 10_000,
			expiresAt: undefined,
			purchaseId: undefined,
			priority: undefined,
		});
	});

	it("passes optional fields through", async () => {
		vi.mocked(grantTopUpCreditsTx).mockResolvedValue(undefined);
		const expiresAt = new Date("2027-01-01");

		await grantTopUpCredits({
			organizationId: "org-1",
			meterKey: "ai_tokens",
			amount: 10_000,
			expiresAt,
			purchaseId: "purchase-1",
			priority: 5,
		});

		expect(grantTopUpCreditsTx).toHaveBeenCalledWith({
			userId: undefined,
			organizationId: "org-1",
			meterKey: "ai_tokens",
			amount: 10_000,
			expiresAt,
			purchaseId: "purchase-1",
			priority: 5,
		});
	});

	it("accepts null expiresAt and purchaseId", async () => {
		vi.mocked(grantTopUpCreditsTx).mockResolvedValue(undefined);

		await grantTopUpCredits({
			userId: "user-1",
			meterKey: "ai_tokens",
			amount: 10_000,
			expiresAt: null,
			purchaseId: null,
		});

		expect(grantTopUpCreditsTx).toHaveBeenCalledWith(
			expect.objectContaining({ expiresAt: null, purchaseId: null }),
		);
	});

	it("rejects non-positive amount", async () => {
		await expect(
			grantTopUpCredits({
				userId: "user-1",
				meterKey: "ai_tokens",
				amount: -5,
			}),
		).rejects.toThrow();
	});

	it("rejects non-integer amount", async () => {
		await expect(
			grantTopUpCredits({
				userId: "user-1",
				meterKey: "ai_tokens",
				amount: 2.5,
			}),
		).rejects.toThrow();
	});

	it("propagates tx errors", async () => {
		vi.mocked(grantTopUpCreditsTx).mockRejectedValue(new Error("db down"));

		await expect(
			grantTopUpCredits({
				userId: "user-1",
				meterKey: "ai_tokens",
				amount: 100,
			}),
		).rejects.toThrow("db down");
	});
});
