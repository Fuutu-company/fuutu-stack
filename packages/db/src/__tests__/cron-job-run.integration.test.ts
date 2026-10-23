import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "../../prisma/client";
import {
	claimCronJobRun,
	getCronJobRun,
	recordCronJobRun,
} from "../../prisma/queries/cron-job-run";

// process.env.RUN_DB_TESTS is a deliberate test-flag exception to the
// no-process.env rule.
describe.skipIf(!process.env.RUN_DB_TESTS)(
	"cron job claim (integration)",
	() => {
		const jobKey = `it_job_${randomUUID()}`;

		afterEach(async () => {
			await db.cronJobRun.deleteMany({ where: { jobKey } });
		});

		it("lets exactly one trigger win when the row does not exist yet", async () => {
			const claimedAt = new Date();

			const results = await Promise.all(
				Array.from({ length: 8 }, () =>
					claimCronJobRun(jobKey, null, claimedAt),
				),
			);

			expect(results.filter(Boolean)).toHaveLength(1);
			const row = await getCronJobRun(jobKey);
			expect(row?.lastStatus).toBe("running");
		});

		it("lets exactly one trigger win a CAS claim for the observed lastRunAt", async () => {
			const first = await claimCronJobRun(jobKey, null, new Date());
			expect(first).toBe(true);

			const observed = (await getCronJobRun(jobKey))?.lastRunAt;
			if (!observed) throw new Error("setup: cron row missing");
			const claimedAt = new Date(observed.getTime() + 60_000);

			const results = await Promise.all(
				Array.from({ length: 8 }, () =>
					claimCronJobRun(jobKey, observed, claimedAt),
				),
			);

			expect(results.filter(Boolean)).toHaveLength(1);
			const row = await getCronJobRun(jobKey);
			expect(row?.lastRunAt).toEqual(claimedAt);
		});

		it("records the final status after a claim", async () => {
			expect(await claimCronJobRun(jobKey, null, new Date())).toBe(true);

			const finishedAt = new Date();
			await recordCronJobRun(jobKey, "success", finishedAt);

			const row = await getCronJobRun(jobKey);
			expect(row).toMatchObject({
				jobKey,
				lastStatus: "success",
				lastRunAt: finishedAt,
				lastError: null,
			});
		});
	},
);
