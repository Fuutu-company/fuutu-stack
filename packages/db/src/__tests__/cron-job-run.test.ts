import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../prisma/client", () => ({
	db: {
		cronJobRun: {
			findUnique: vi.fn(),
			create: vi.fn(),
			updateMany: vi.fn(),
			upsert: vi.fn(),
		},
	},
}));

import { db } from "../../prisma/client";
import {
	claimCronJobRun,
	getCronJobRun,
	recordCronJobRun,
} from "../../prisma/queries/cron-job-run";

function makeP2002(): Error {
	return Object.assign(new Error("Unique constraint failed"), {
		code: "P2002",
	});
}

describe("cron-job-run queries", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getCronJobRun", () => {
		it("looks up the run by jobKey", async () => {
			vi.mocked(db.cronJobRun.findUnique).mockResolvedValue(null);

			await getCronJobRun("cleanup");

			expect(db.cronJobRun.findUnique).toHaveBeenCalledWith({
				where: { jobKey: "cleanup" },
			});
		});
	});

	describe("claimCronJobRun", () => {
		it("creates the row when no run was observed (expectedLastRunAt null)", async () => {
			vi.mocked(db.cronJobRun.create).mockResolvedValue({} as never);
			const claimedAt = new Date("2026-01-01T00:00:00Z");

			const claimed = await claimCronJobRun("cleanup", null, claimedAt);

			expect(claimed).toBe(true);
			expect(db.cronJobRun.create).toHaveBeenCalledWith({
				data: {
					jobKey: "cleanup",
					lastRunAt: claimedAt,
					lastStatus: "running",
				},
			});
		});

		it("returns false on P2002 — another trigger won the create race", async () => {
			vi.mocked(db.cronJobRun.create).mockRejectedValue(makeP2002());

			const claimed = await claimCronJobRun("cleanup", null, new Date());

			expect(claimed).toBe(false);
		});

		it("rethrows non-unique errors from the create path", async () => {
			vi.mocked(db.cronJobRun.create).mockRejectedValue(new Error("boom"));

			await expect(
				claimCronJobRun("cleanup", null, new Date()),
			).rejects.toThrow("boom");
		});

		it("claims via compare-and-swap updateMany guarded by the observed lastRunAt", async () => {
			vi.mocked(db.cronJobRun.updateMany).mockResolvedValue({ count: 1 });
			const expected = new Date("2026-01-01T00:00:00Z");
			const claimedAt = new Date("2026-01-01T01:00:00Z");

			const claimed = await claimCronJobRun("cleanup", expected, claimedAt);

			expect(claimed).toBe(true);
			expect(db.cronJobRun.updateMany).toHaveBeenCalledWith({
				where: { jobKey: "cleanup", lastRunAt: expected },
				data: { lastRunAt: claimedAt, lastStatus: "running" },
			});
		});

		it("returns false when the CAS matches no row — another trigger advanced lastRunAt", async () => {
			vi.mocked(db.cronJobRun.updateMany).mockResolvedValue({ count: 0 });

			const claimed = await claimCronJobRun(
				"cleanup",
				new Date("2026-01-01T00:00:00Z"),
				new Date("2026-01-01T01:00:00Z"),
			);

			expect(claimed).toBe(false);
		});
	});

	describe("recordCronJobRun", () => {
		it("upserts the final status for the job", async () => {
			vi.mocked(db.cronJobRun.upsert).mockResolvedValue({} as never);
			const runAt = new Date("2026-01-01T02:00:00Z");

			await recordCronJobRun("cleanup", "error", runAt, "disk full");

			expect(db.cronJobRun.upsert).toHaveBeenCalledWith({
				where: { jobKey: "cleanup" },
				create: {
					jobKey: "cleanup",
					lastRunAt: runAt,
					lastStatus: "error",
					lastError: "disk full",
				},
				update: {
					lastRunAt: runAt,
					lastStatus: "error",
					lastError: "disk full",
				},
			});
		});

		it("stores null lastError when none is given", async () => {
			vi.mocked(db.cronJobRun.upsert).mockResolvedValue({} as never);
			const runAt = new Date("2026-01-01T02:00:00Z");

			await recordCronJobRun("cleanup", "success", runAt);

			expect(db.cronJobRun.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					create: expect.objectContaining({ lastError: null }),
					update: expect.objectContaining({ lastError: null }),
				}),
			);
		});

		it("writes via CAS updateMany guarded by claimedAt when provided", async () => {
			vi.mocked(db.cronJobRun.updateMany).mockResolvedValue({ count: 1 });
			const runAt = new Date("2026-01-01T02:00:00Z");
			const claimedAt = new Date("2026-01-01T01:00:00Z");

			await recordCronJobRun("cleanup", "success", runAt, undefined, claimedAt);

			expect(db.cronJobRun.updateMany).toHaveBeenCalledWith({
				where: { jobKey: "cleanup", lastRunAt: claimedAt },
				data: { lastRunAt: runAt, lastStatus: "success", lastError: null },
			});
			expect(db.cronJobRun.upsert).not.toHaveBeenCalled();
		});

		it("drops a stale finisher whose claim was superseded (count 0 → no upsert)", async () => {
			vi.mocked(db.cronJobRun.updateMany).mockResolvedValue({ count: 0 });
			const runAt = new Date("2026-01-01T02:00:00Z");
			const claimedAt = new Date("2026-01-01T01:00:00Z");

			await recordCronJobRun("cleanup", "success", runAt, undefined, claimedAt);

			expect(db.cronJobRun.upsert).not.toHaveBeenCalled();
		});
	});
});
