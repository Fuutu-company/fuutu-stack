import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../prisma/client";
import { recoverStaleDeliveries } from "../../prisma/queries/webhook";

const RECOVERY_PARAMS = {
	timeoutMs: 5 * 60 * 1000,
	maxRetries: 5,
	retryBaseDelayMs: 1000,
	maxRetryDelayMs: 60 * 60 * 1000,
};

// process.env.RUN_DB_TESTS is a deliberate test-flag exception to the
// no-process.env rule.
describe.skipIf(!process.env.RUN_DB_TESTS)(
	"recoverStaleDeliveries (integration)",
	() => {
		const runId = randomUUID();
		let organizationId: string;
		let webhookId: string;

		beforeEach(async () => {
			const org = await db.organization.create({
				data: {
					id: `it_org_${runId}_${randomUUID()}`,
					name: "Integration Test Org",
					slug: `it-${randomUUID()}`,
					createdAt: new Date(),
				},
			});
			organizationId = org.id;
			const webhook = await db.webhook.create({
				data: {
					organizationId,
					url: "https://example.com/hook",
					events: ["test.event"],
					secret: "test-secret",
				},
			});
			webhookId = webhook.id;
		});

		afterEach(async () => {
			await db.webhook.deleteMany({ where: { organizationId } });
			await db.organization.deleteMany({ where: { id: organizationId } });
		});

		const createDelivery = (data: {
			status: string;
			attempt: number;
			attemptedAt: Date;
		}) =>
			db.webhookDelivery.create({
				data: {
					webhookId,
					eventId: `evt_${randomUUID()}`,
					eventType: "test.event",
					payload: { ok: true },
					...data,
				},
			});

		it("increments attempt and schedules a backoff retry for stale processing rows", async () => {
			const staleAt = new Date(Date.now() - 60 * 60 * 1000);
			const delivery = await createDelivery({
				status: "processing",
				attempt: 2,
				attemptedAt: staleAt,
			});

			await recoverStaleDeliveries(RECOVERY_PARAMS);

			const row = await db.webhookDelivery.findUniqueOrThrow({
				where: { id: delivery.id },
			});
			expect(row.status).toBe("retrying");
			expect(row.attempt).toBe(3);
			if (!row.nextRetryAt) {
				throw new Error("recovered delivery must have a backoff nextRetryAt");
			}
			// Backoff for attempt 3 = 2^3 * 1000ms in [4s, 8s] with jitter.
			expect(row.nextRetryAt.getTime()).toBeGreaterThan(Date.now() + 1000);
			expect(row.nextRetryAt.getTime()).toBeLessThan(
				Date.now() + RECOVERY_PARAMS.maxRetryDelayMs,
			);
		});

		it("marks stale rows terminal-failed once the retry budget is exhausted", async () => {
			const staleAt = new Date(Date.now() - 60 * 60 * 1000);
			const delivery = await createDelivery({
				status: "processing",
				attempt: RECOVERY_PARAMS.maxRetries,
				attemptedAt: staleAt,
			});

			await recoverStaleDeliveries(RECOVERY_PARAMS);

			const row = await db.webhookDelivery.findUniqueOrThrow({
				where: { id: delivery.id },
			});
			expect(row.status).toBe("failed");
			expect(row.attempt).toBe(RECOVERY_PARAMS.maxRetries + 1);
			expect(row.nextRetryAt).toBeNull();
		});

		it("leaves recently-claimed in-flight rows untouched", async () => {
			const delivery = await createDelivery({
				status: "processing",
				attempt: 1,
				attemptedAt: new Date(),
			});

			await recoverStaleDeliveries(RECOVERY_PARAMS);

			const row = await db.webhookDelivery.findUniqueOrThrow({
				where: { id: delivery.id },
			});
			expect(row.status).toBe("processing");
			expect(row.attempt).toBe(1);
		});
	},
);
