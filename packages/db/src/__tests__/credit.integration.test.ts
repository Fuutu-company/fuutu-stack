import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../prisma/client";
import {
	consumeCreditsTx,
	grantRecurringCreditsTx,
} from "../../prisma/queries/credit-balance";

// Requires a migrated database (migrate deploy, not db:push) — the
// concurrency and XOR assertions rely on the raw-SQL partial unique
// indexes and CHECK constraints from prisma/migrations/.
// process.env.RUN_DB_TESTS is a deliberate test-flag exception to the
// no-process.env rule.
describe.skipIf(!process.env.RUN_DB_TESTS)(
	"credit consume (integration)",
	() => {
		const runId = randomUUID();
		const meterKey = `it_meter_${runId}`;
		let userId: string;
		let organizationId: string;

		beforeEach(async () => {
			const user = await db.user.create({
				data: {
					id: `it_user_${runId}_${randomUUID()}`,
					name: "Integration Test User",
					email: `it-${randomUUID()}@example.com`,
				},
			});
			userId = user.id;
			const org = await db.organization.create({
				data: {
					id: `it_org_${runId}_${randomUUID()}`,
					name: "Integration Test Org",
					slug: `it-${randomUUID()}`,
					createdAt: new Date(),
				},
			});
			organizationId = org.id;
		});

		afterEach(async () => {
			// creditEvent owner FKs are SetNull — delete events explicitly so
			// orphaned owner-less rows never leak between runs.
			await db.creditEvent.deleteMany({ where: { meterKey } });
			await db.user.deleteMany({ where: { id: userId } });
			await db.organization.deleteMany({ where: { id: organizationId } });
		});

		const grant = (amount: number) =>
			grantRecurringCreditsTx({
				userId,
				meterKey,
				amount,
				periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
			});

		it("debits each credit exactly once under concurrent consumes", async () => {
			await grant(100);

			const settled = await Promise.allSettled(
				Array.from({ length: 10 }, () =>
					consumeCreditsTx({
						userId,
						meterKey,
						amount: 30,
						reason: "it_concurrent",
						allowOverage: false,
					}),
				),
			);

			// Losers either return ok:false (early sufficiency check) or reject
			// (CAS lost) — never a partial or over-grant debit.
			const succeeded = settled.filter(
				(r) => r.status === "fulfilled" && r.value.ok,
			);
			expect(succeeded).toHaveLength(3);

			const balance = await db.creditBalance.findFirst({
				where: { userId, meterKey },
			});
			expect(balance?.recurringConsumed).toBe(90);

			const events = await db.creditEvent.findMany({
				where: { userId, meterKey, source: "recurring" },
			});
			expect(events).toHaveLength(3);
			expect(events.reduce((sum, e) => sum + e.amount, 0)).toBe(90);
		});

		it("replays the recorded result for a redelivered idempotency key", async () => {
			await grant(100);
			const idempotencyKey = `it-${randomUUID()}`;
			const params = {
				userId,
				meterKey,
				amount: 40,
				reason: "it_dedup",
				allowOverage: false,
				idempotencyKey,
			};

			const first = await consumeCreditsTx(params);
			const replay = await consumeCreditsTx(params);

			expect(first).toMatchObject({
				ok: true,
				consumed: 40,
				remaining: 60,
				source: "recurring",
			});
			expect(replay).toEqual({ ...first, deduplicated: true });

			const balance = await db.creditBalance.findFirst({
				where: { userId, meterKey },
			});
			expect(balance?.recurringConsumed).toBe(40);
		});

		it("debits exactly once for concurrent consumes sharing an idempotency key", async () => {
			await grant(100);
			const idempotencyKey = `it-${randomUUID()}`;

			const settled = await Promise.allSettled(
				Array.from({ length: 5 }, () =>
					consumeCreditsTx({
						userId,
						meterKey,
						amount: 40,
						reason: "it_dedup_race",
						allowOverage: false,
						idempotencyKey,
					}),
				),
			);

			expect(settled.every((r) => r.status === "fulfilled")).toBe(true);
			const results = settled.map((r) =>
				r.status === "fulfilled" ? r.value : undefined,
			);
			for (const result of results) {
				expect(result).toMatchObject({
					ok: true,
					consumed: 40,
					remaining: 60,
				});
			}
			// Exactly one winner recorded the debit; the rest replayed it.
			expect(results.filter((r) => r?.deduplicated !== true)).toHaveLength(1);

			const balance = await db.creditBalance.findFirst({
				where: { userId, meterKey },
			});
			expect(balance?.recurringConsumed).toBe(40);

			const keyedEvents = await db.creditEvent.findMany({
				where: { userId, meterKey, idempotencyKey },
			});
			expect(keyedEvents).toHaveLength(1);
		});

		it("rejects credit_balance rows violating the owner XOR CHECK", async () => {
			await expect(
				db.creditBalance.create({
					data: {
						userId,
						organizationId,
						meterKey,
						recurringPeriodEnd: new Date(),
					},
				}),
			).rejects.toThrow();

			await expect(
				db.creditBalance.create({
					data: {
						meterKey,
						recurringPeriodEnd: new Date(),
					},
				}),
			).rejects.toThrow();
		});
	},
);
