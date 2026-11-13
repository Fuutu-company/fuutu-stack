import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Owner invariant on polymorphic tables (purchase, credit_balance,
 * credit_package): exactly one of userId / organizationId. Prisma has no
 * CHECK constraints, so the query functions — the only write path (see the
 * db-access architecture guard) — reject a bad owner before touching the DB.
 */

vi.mock("../../prisma/client", () => ({
	db: {
		$transaction: vi.fn(),
		purchase: { create: vi.fn() },
	},
}));

const { db } = await import("../../prisma/client");
const { assertSingleOwner } = await import("../../prisma/queries/owner");
const { createPurchase } = await import("../../prisma/queries/purchase");
const { consumeCreditsTx, grantRecurringCreditsTx, grantTopUpCreditsTx } =
	await import("../../prisma/queries/credit-balance");

const both = { userId: "u1", organizationId: "o1" };
const none = { userId: null, organizationId: null };

describe("assertSingleOwner", () => {
	it("accepts exactly one owner", () => {
		expect(() => assertSingleOwner({ userId: "u1" })).not.toThrow();
		expect(() => assertSingleOwner({ organizationId: "o1" })).not.toThrow();
	});

	it.each([
		["both", both],
		["none", none],
	])("rejects %s", (_, owner) => {
		expect(() => assertSingleOwner(owner)).toThrow(/exactly one of userId/);
	});
});

describe("write paths reject a bad owner before touching the DB", () => {
	beforeEach(() => vi.clearAllMocks());

	it.each([
		["both", both],
		["none", none],
	])("createPurchase — %s", (_, owner) => {
		expect(() =>
			createPurchase({
				type: "ONE_TIME",
				status: "ACTIVE",
				provider: "stripe",
				priceId: "price_1",
				...owner,
			}),
		).toThrow(/exactly one of userId/);
		expect(db.purchase.create).not.toHaveBeenCalled();
	});

	it.each([
		["both", both],
		["none", none],
	])("credit writes — %s", async (_, raw) => {
		const owner = {
			userId: raw.userId ?? undefined,
			organizationId: raw.organizationId ?? undefined,
		};
		const meter = { meterKey: "ai_tokens", amount: 5 };
		await expect(
			consumeCreditsTx({
				...owner,
				...meter,
				reason: "test",
				allowOverage: false,
			}),
		).rejects.toThrow(/exactly one of userId/);
		await expect(
			grantRecurringCreditsTx({ ...owner, ...meter, periodEnd: new Date() }),
		).rejects.toThrow(/exactly one of userId/);
		await expect(grantTopUpCreditsTx({ ...owner, ...meter })).rejects.toThrow(
			/exactly one of userId/,
		);
		expect(db.$transaction).not.toHaveBeenCalled();
	});
});
