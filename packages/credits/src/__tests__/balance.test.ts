import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/db", () => ({
	getCreditBalancesForUser: vi.fn(),
	getCreditBalancesForOrganization: vi.fn(),
	getActiveCreditPackages: vi.fn(),
}));

vi.mock("@fuutu/payments/config", () => ({
	CREDIT_METERS: [
		{
			key: "ai_tokens",
			label: "AI Tokens",
			unit: "tokens",
			resetOn: "month",
			allowOverage: true,
		},
		{ key: "api_calls", label: "API Calls", unit: "count", resetOn: "month" },
		{ key: "documents", label: "Documents", unit: "count", resetOn: "month" },
	],
}));

import {
	getActiveCreditPackages,
	getCreditBalancesForOrganization,
	getCreditBalancesForUser,
} from "@fuutu/db";
import { getCreditBalanceSummary } from "../balance";

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(getActiveCreditPackages).mockResolvedValue([]);
});

describe("getCreditBalanceSummary", () => {
	it("fetches balances for user when userId is set", async () => {
		vi.mocked(getCreditBalancesForUser).mockResolvedValue([]);

		await getCreditBalanceSummary({ userId: "user-1" });

		expect(getCreditBalancesForUser).toHaveBeenCalledWith("user-1");
		expect(getCreditBalancesForOrganization).not.toHaveBeenCalled();
	});

	it("fetches balances for org when only organizationId is set", async () => {
		vi.mocked(getCreditBalancesForOrganization).mockResolvedValue([]);

		await getCreditBalanceSummary({ organizationId: "org-1" });

		expect(getCreditBalancesForOrganization).toHaveBeenCalledWith("org-1");
		expect(getCreditBalancesForUser).not.toHaveBeenCalled();
	});

	it("returns one summary per meter even when no balances exist", async () => {
		vi.mocked(getCreditBalancesForUser).mockResolvedValue([]);

		const summaries = await getCreditBalanceSummary({ userId: "user-1" });

		expect(summaries).toHaveLength(3);
		expect(summaries.map((s) => s.meterKey)).toEqual([
			"ai_tokens",
			"api_calls",
			"documents",
		]);
		for (const s of summaries) {
			expect(s.recurring).toEqual({
				granted: 0,
				consumed: 0,
				remaining: 0,
				periodEnd: null,
			});
			expect(s.topups).toEqual({
				total: 0,
				consumed: 0,
				remaining: 0,
				packageCount: 0,
			});
			expect(s.total).toBe(0);
		}
	});

	it("computes recurring remaining as granted - consumed", async () => {
		vi.mocked(getCreditBalancesForUser).mockResolvedValue([
			{
				meterKey: "ai_tokens",
				recurringGranted: 500,
				recurringConsumed: 120,
				recurringPeriodEnd: new Date("2026-12-31"),
			},
		] as never);

		const summaries = await getCreditBalanceSummary({ userId: "user-1" });
		const ai = summaries.find((s) => s.meterKey === "ai_tokens");

		expect(ai?.recurring).toEqual({
			granted: 500,
			consumed: 120,
			remaining: 380,
			periodEnd: new Date("2026-12-31"),
		});
	});

	it("clamps recurring remaining at zero when consumed exceeds granted", async () => {
		vi.mocked(getCreditBalancesForUser).mockResolvedValue([
			{
				meterKey: "ai_tokens",
				recurringGranted: 100,
				recurringConsumed: 150,
				recurringPeriodEnd: null,
			},
		] as never);

		const summaries = await getCreditBalanceSummary({ userId: "user-1" });
		const ai = summaries.find((s) => s.meterKey === "ai_tokens");

		expect(ai?.recurring.remaining).toBe(0);
	});

	it("aggregates topup packages correctly", async () => {
		vi.mocked(getCreditBalancesForUser).mockResolvedValue([]);
		vi.mocked(getActiveCreditPackages).mockResolvedValue([
			{ amount: 1000, consumed: 200 },
			{ amount: 500, consumed: 500 },
		] as never);

		const summaries = await getCreditBalanceSummary({ userId: "user-1" });
		const ai = summaries.find((s) => s.meterKey === "ai_tokens");

		expect(ai?.topups).toEqual({
			total: 1500,
			consumed: 700,
			remaining: 800,
			packageCount: 2,
		});
	});

	it("total = recurring remaining + topup remaining", async () => {
		vi.mocked(getCreditBalancesForUser).mockResolvedValue([
			{
				meterKey: "ai_tokens",
				recurringGranted: 1000,
				recurringConsumed: 400,
				recurringPeriodEnd: null,
			},
		] as never);
		vi.mocked(getActiveCreditPackages).mockResolvedValue([
			{ amount: 2000, consumed: 500 },
		] as never);

		const summaries = await getCreditBalanceSummary({ userId: "user-1" });
		const ai = summaries.find((s) => s.meterKey === "ai_tokens");

		expect(ai?.total).toBe(600 + 1500);
	});

	it("carries meter label and unit into summary", async () => {
		vi.mocked(getCreditBalancesForUser).mockResolvedValue([]);

		const summaries = await getCreditBalanceSummary({ userId: "user-1" });

		expect(summaries.find((s) => s.meterKey === "ai_tokens")).toMatchObject({
			label: "AI Tokens",
			unit: "tokens",
		});
		expect(summaries.find((s) => s.meterKey === "documents")).toMatchObject({
			label: "Documents",
			unit: "count",
		});
	});

	it("queries active packages per meter with the right owner", async () => {
		vi.mocked(getCreditBalancesForOrganization).mockResolvedValue([]);

		await getCreditBalanceSummary({ organizationId: "org-1" });

		expect(getActiveCreditPackages).toHaveBeenCalledTimes(3);
		for (const call of vi.mocked(getActiveCreditPackages).mock.calls) {
			expect(call[0]).toMatchObject({
				organizationId: "org-1",
				userId: undefined,
			});
		}
	});
});
