import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../prisma/client";
import { createApiKeyWithinLimit } from "../../prisma/queries/api-key";

// process.env.RUN_DB_TESTS is a deliberate test-flag exception to the
// no-process.env rule.
describe.skipIf(!process.env.RUN_DB_TESTS)(
	"createApiKeyWithinLimit (integration)",
	() => {
		const runId = randomUUID();
		let userId: string;

		beforeEach(async () => {
			const user = await db.user.create({
				data: {
					id: `it_user_${runId}_${randomUUID()}`,
					name: "Integration Test User",
					email: `it-${randomUUID()}@example.com`,
				},
			});
			userId = user.id;
		});

		afterEach(async () => {
			await db.apiKey.deleteMany({ where: { userId } });
			await db.user.deleteMany({ where: { id: userId } });
		});

		it("never exceeds the limit under parallel creates", async () => {
			const max = 3;
			const settled = await Promise.allSettled(
				Array.from({ length: 10 }, (_, i) =>
					createApiKeyWithinLimit({
						userId,
						name: `key-${i}`,
						max,
					}),
				),
			);

			// Serialization losers retry up to 3 attempts and may still reject
			// under contention — the invariant is the committed row count.
			const created = settled.filter(
				(r) => r.status === "fulfilled" && r.value !== null,
			);
			expect(created.length).toBeGreaterThan(0);
			expect(created.length).toBeLessThanOrEqual(max);

			const rows = await db.apiKey.count({
				where: { userId, revokedAt: null },
			});
			expect(rows).toBe(created.length);
			expect(rows).toBeLessThanOrEqual(max);
		});

		it("creates all keys when the limit is not reached", async () => {
			const results = await Promise.all(
				Array.from({ length: 3 }, (_, i) =>
					createApiKeyWithinLimit({
						userId,
						name: `key-${i}`,
						max: 10,
					}),
				),
			);

			expect(results.every((r) => r !== null)).toBe(true);
			const rows = await db.apiKey.count({
				where: { userId, revokedAt: null },
			});
			expect(rows).toBe(3);
		});

		it("returns null once the limit is already reached", async () => {
			await Promise.all(
				Array.from({ length: 2 }, (_, i) =>
					createApiKeyWithinLimit({ userId, name: `key-${i}`, max: 2 }),
				),
			);

			const result = await createApiKeyWithinLimit({
				userId,
				name: "over-limit",
				max: 2,
			});

			expect(result).toBeNull();
			const rows = await db.apiKey.count({
				where: { userId, revokedAt: null },
			});
			expect(rows).toBe(2);
		});
	},
);
