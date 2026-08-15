import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/db", () => ({
	consumeCreditsTx: vi.fn(),
	getCreditBalance: vi.fn(),
	getActiveCreditPackages: vi.fn(),
}));

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	}),
}));

vi.mock("@fuutu/payments/config", () => ({
	getMeter: vi.fn((key: string) =>
		key === "ai_tokens"
			? {
					key: "ai_tokens",
					label: "AI Tokens",
					unit: "tokens",
					resetOn: "month",
					allowOverage: true,
				}
			: key === "api_calls"
				? {
						key: "api_calls",
						label: "API Calls",
						unit: "count",
						resetOn: "month",
					}
				: undefined,
	),
}));

import {
	consumeCreditsTx,
	getActiveCreditPackages,
	getCreditBalance,
} from "@fuutu/db";
import { checkCredits, consumeCredits } from "../consume";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("consumeCredits", () => {
	it("throws when neither userId nor organizationId is set", async () => {
		await expect(
			consumeCredits({ meterKey: "ai_tokens", amount: 10, reason: "test" }),
		).rejects.toThrow("either userId or organizationId must be set");
	});

	it("throws on unknown meter key", async () => {
		await expect(
			consumeCredits({
				userId: "user-1",
				meterKey: "unknown_meter",
				amount: 10,
				reason: "test",
			}),
		).rejects.toThrow('unknown meter key "unknown_meter"');
	});

	it("passes allowOverage=false from meter without allowOverage", async () => {
		vi.mocked(consumeCreditsTx).mockResolvedValue({
			ok: true,
			consumed: 10,
			remaining: 90,
			source: "recurring",
		});

		await consumeCredits({
			userId: "user-1",
			meterKey: "api_calls",
			amount: 10,
			reason: "test",
		});

		expect(consumeCreditsTx).toHaveBeenCalledWith(
			expect.objectContaining({ allowOverage: false }),
		);
	});

	it("passes allowOverage=true from meter with allowOverage", async () => {
		vi.mocked(consumeCreditsTx).mockResolvedValue({
			ok: true,
			consumed: 10,
			remaining: 90,
			source: "recurring",
		});

		await consumeCredits({
			userId: "user-1",
			meterKey: "ai_tokens",
			amount: 10,
			reason: "test",
		});

		expect(consumeCreditsTx).toHaveBeenCalledWith(
			expect.objectContaining({ allowOverage: true }),
		);
	});

	it("returns ok result unchanged", async () => {
		const okResult = {
			ok: true,
			consumed: 10,
			remaining: 90,
			source: "recurring" as const,
		};
		vi.mocked(consumeCreditsTx).mockResolvedValue(okResult);

		const result = await consumeCredits({
			userId: "user-1",
			meterKey: "ai_tokens",
			amount: 10,
			reason: "test",
		});

		expect(result).toEqual(okResult);
	});

	it("returns credits_exceeded result unchanged", async () => {
		const exceededResult = {
			ok: false,
			consumed: 0,
			remaining: 0,
			source: "recurring" as const,
			error: "credits_exceeded" as const,
		};
		vi.mocked(consumeCreditsTx).mockResolvedValue(exceededResult);

		const result = await consumeCredits({
			userId: "user-1",
			meterKey: "api_calls",
			amount: 1000,
			reason: "test",
		});

		expect(result).toEqual(exceededResult);
	});

	it("rejects non-positive amount via schema", async () => {
		await expect(
			consumeCredits({
				userId: "user-1",
				meterKey: "ai_tokens",
				amount: 0,
				reason: "test",
			}),
		).rejects.toThrow();
	});

	it("rejects non-integer amount via schema", async () => {
		await expect(
			consumeCredits({
				userId: "user-1",
				meterKey: "ai_tokens",
				amount: 1.5,
				reason: "test",
			}),
		).rejects.toThrow();
	});

	it("passes metadata through to tx", async () => {
		vi.mocked(consumeCreditsTx).mockResolvedValue({
			ok: true,
			consumed: 10,
			remaining: 90,
			source: "recurring",
		});

		await consumeCredits({
			userId: "user-1",
			meterKey: "ai_tokens",
			amount: 10,
			reason: "test",
			metadata: { requestId: "req-1" },
		});

		expect(consumeCreditsTx).toHaveBeenCalledWith(
			expect.objectContaining({ metadata: { requestId: "req-1" } }),
		);
	});

	it("works with organizationId instead of userId", async () => {
		vi.mocked(consumeCreditsTx).mockResolvedValue({
			ok: true,
			consumed: 10,
			remaining: 90,
			source: "recurring",
		});

		await consumeCredits({
			organizationId: "org-1",
			meterKey: "ai_tokens",
			amount: 10,
			reason: "test",
		});

		expect(consumeCreditsTx).toHaveBeenCalledWith(
			expect.objectContaining({ organizationId: "org-1", userId: undefined }),
		);
	});
});

describe("checkCredits", () => {
	it("throws on unknown meter key", async () => {
		await expect(
			checkCredits({ userId: "user-1", meterKey: "unknown", amount: 10 }),
		).rejects.toThrow('unknown meter key "unknown"');
	});

	it("allows when recurring credits cover the amount", async () => {
		vi.mocked(getCreditBalance).mockResolvedValue({
			recurringGranted: 100,
			recurringConsumed: 10,
		} as never);
		vi.mocked(getActiveCreditPackages).mockResolvedValue([]);

		const result = await checkCredits({
			userId: "user-1",
			meterKey: "ai_tokens",
			amount: 50,
		});

		expect(result).toEqual({
			allowed: true,
			remaining: 40,
			wouldUseTopup: false,
		});
	});

	it("allows when recurring + topup cover the amount and sets wouldUseTopup", async () => {
		vi.mocked(getCreditBalance).mockResolvedValue({
			recurringGranted: 100,
			recurringConsumed: 90,
		} as never);
		vi.mocked(getActiveCreditPackages).mockResolvedValue([
			{ amount: 200, consumed: 0 } as never,
		]);

		const result = await checkCredits({
			userId: "user-1",
			meterKey: "ai_tokens",
			amount: 50,
		});

		expect(result).toEqual({
			allowed: true,
			remaining: 160,
			wouldUseTopup: true,
		});
	});

	it("denies when insufficient credits and no overage allowed", async () => {
		vi.mocked(getCreditBalance).mockResolvedValue({
			recurringGranted: 100,
			recurringConsumed: 100,
		} as never);
		vi.mocked(getActiveCreditPackages).mockResolvedValue([]);

		const result = await checkCredits({
			userId: "user-1",
			meterKey: "api_calls",
			amount: 10,
		});

		expect(result).toEqual({
			allowed: false,
			remaining: 0,
			wouldUseTopup: false,
		});
	});

	it("allows via overage when meter allows it", async () => {
		vi.mocked(getCreditBalance).mockResolvedValue({
			recurringGranted: 100,
			recurringConsumed: 100,
		} as never);
		vi.mocked(getActiveCreditPackages).mockResolvedValue([]);

		const result = await checkCredits({
			userId: "user-1",
			meterKey: "ai_tokens",
			amount: 10,
		});

		expect(result).toEqual({
			allowed: true,
			remaining: -10,
			wouldUseTopup: true,
		});
	});

	it("treats null balance as zero credits", async () => {
		vi.mocked(getCreditBalance).mockResolvedValue(null);
		vi.mocked(getActiveCreditPackages).mockResolvedValue([]);

		const result = await checkCredits({
			userId: "user-1",
			meterKey: "api_calls",
			amount: 10,
		});

		expect(result).toEqual({
			allowed: false,
			remaining: 0,
			wouldUseTopup: false,
		});
	});

	it("treats null balance as zero but allows overage meters", async () => {
		vi.mocked(getCreditBalance).mockResolvedValue(null);
		vi.mocked(getActiveCreditPackages).mockResolvedValue([]);

		const result = await checkCredits({
			userId: "user-1",
			meterKey: "ai_tokens",
			amount: 10,
		});

		expect(result).toEqual({
			allowed: true,
			remaining: -10,
			wouldUseTopup: true,
		});
	});

	it("clamps recurring remaining at zero when consumed exceeds granted", async () => {
		vi.mocked(getCreditBalance).mockResolvedValue({
			recurringGranted: 50,
			recurringConsumed: 80,
		} as never);
		vi.mocked(getActiveCreditPackages).mockResolvedValue([
			{ amount: 100, consumed: 0 } as never,
		]);

		const result = await checkCredits({
			userId: "user-1",
			meterKey: "api_calls",
			amount: 40,
		});

		expect(result).toEqual({
			allowed: true,
			remaining: 60,
			wouldUseTopup: true,
		});
	});
});
