import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/webhooks", () => ({
	processPendingDeliveries: vi.fn().mockResolvedValue({
		processed: 3,
		succeeded: 2,
		failed: 1,
	}),
}));

vi.mock("@fuutu/db", () => ({
	deleteAuditLogsBefore: vi.fn().mockResolvedValue({ count: 5 }),
	getTrialingSubscriptions: vi.fn().mockResolvedValue([]),
	notificationExists: vi.fn().mockResolvedValue(false),
	getCronJobRun: vi.fn().mockResolvedValue(null),
	claimCronJobRun: vi.fn().mockResolvedValue(true),
	recordCronJobRun: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@fuutu/payments/config", () => ({
	LIMITS: {
		free: { auditLogDays: false },
		pro: { auditLogDays: 30 },
		// Finite on every plan — "unlimited" makes the job a no-op.
		enterprise: { auditLogDays: 90 },
	},
}));

vi.mock("@fuutu/i18n", () => ({
	getMessagesForLocale: vi.fn().mockResolvedValue({
		cron: {
			subscriptionReminder: {
				title: "Subscription reminder",
				body: "Your trial subscription is ending soon.",
			},
		},
	}),
}));

vi.mock("@fuutu/notifications", () => ({
	resolveNotificationProvider: vi.fn(() => ({
		id: "test",
		notify: vi.fn().mockResolvedValue(undefined),
	})),
}));

vi.mock("@fuutu/telemetry", () => ({
	pingTelemetry: vi.fn().mockResolvedValue({ sent: true, status: 200 }),
}));

import { claimCronJobRun, getCronJobRun, recordCronJobRun } from "@fuutu/db";
import { processPendingDeliveries } from "@fuutu/webhooks";
import { cronConfig } from "../config";
import { listJobs, runAllJobs, runJob } from "../runner";
import { InlineJobRunner } from "../runners/inline";
import type { CronJob, CronJobResult } from "../types";

const ALL_JOBS = [
	"webhook-retry",
	"audit-log-cleanup",
	"subscription-reminder",
	"telemetry-ping",
];

const DONE: CronJobResult = { success: true, processed: 1, errors: [] };

function makeRunnerJob(name: string, run: CronJob["run"]): CronJob {
	return { name, schedule: "* * * * *", enabled: true, run };
}

function deferred(): {
	promise: Promise<CronJobResult>;
	resolve: (r: CronJobResult) => void;
} {
	let resolve: (r: CronJobResult) => void = () => {};
	const promise = new Promise<CronJobResult>((r) => {
		resolve = r;
	});
	return { promise, resolve };
}

describe("runJob", () => {
	it("runs a known job and returns a result", async () => {
		const result = await runJob("webhook-retry");
		expect(result.success).toBe(true);
		expect(result.processed).toBe(3);
	});

	it("returns failure for unknown job name", async () => {
		const result = await runJob("nonexistent");
		expect(result.success).toBe(false);
		expect(result.errors).toContain('unknown job "nonexistent"');
	});

	it("reports failure when force-running a disabled job", async () => {
		cronConfig.jobs.webhookRetry = false;
		try {
			vi.mocked(processPendingDeliveries).mockClear();
			const result = await runJob("webhook-retry");
			expect(result.success).toBe(false);
			expect(result.errors).toContain('job "webhook-retry" is disabled');
			expect(processPendingDeliveries).not.toHaveBeenCalled();
		} finally {
			cronConfig.jobs.webhookRetry = true;
		}
	});

	it("force-runs a job even when it is not due", async () => {
		vi.mocked(getCronJobRun).mockResolvedValue({
			lastRunAt: new Date(),
		} as never);
		const result = await runJob("webhook-retry");
		expect(result.success).toBe(true);
		expect(processPendingDeliveries).toHaveBeenCalled();
		expect(recordCronJobRun).toHaveBeenCalledWith(
			"webhook-retry",
			"success",
			expect.any(Date),
			undefined,
			undefined,
		);
	});

	it("does not claim a slot on the force-run path", async () => {
		vi.mocked(claimCronJobRun).mockClear();
		await runJob("webhook-retry");
		expect(claimCronJobRun).not.toHaveBeenCalled();
	});
});

describe("runAllJobs", () => {
	beforeEach(() => {
		vi.mocked(getCronJobRun).mockResolvedValue(null);
	});

	it("runs all enabled jobs and returns results for each", async () => {
		const results = await runAllJobs();
		const jobNames = Object.keys(results);
		expect(jobNames).toEqual(expect.arrayContaining(ALL_JOBS));
		for (const name of jobNames) {
			expect(results[name]).toHaveProperty("success");
			expect(results[name]).toHaveProperty("processed");
			expect(results[name]).toHaveProperty("errors");
		}
	});

	it("skips jobs that are not due and records runs for due jobs", async () => {
		// Fixed instant 12:07 — "*/5" job last scheduled slot is 12:05.
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2025, 5, 15, 12, 7, 0));
		try {
			vi.mocked(getCronJobRun).mockImplementation(
				(jobKey: string) =>
					Promise.resolve(
						jobKey === "webhook-retry"
							? { lastRunAt: new Date(2025, 5, 15, 12, 6, 0) } // 1 min ago
							: { lastRunAt: new Date(2025, 5, 5, 0, 0, 0) }, // 10 days ago
					) as never,
			);
			vi.mocked(processPendingDeliveries).mockClear();
			vi.mocked(recordCronJobRun).mockClear();

			const results = await runAllJobs();

			expect(results["webhook-retry"]).toEqual({
				success: true,
				processed: 0,
				errors: [],
			});
			expect(processPendingDeliveries).not.toHaveBeenCalled();
			expect(results["audit-log-cleanup"]?.processed).toBe(5);
			expect(recordCronJobRun).toHaveBeenCalledWith(
				"audit-log-cleanup",
				"success",
				expect.any(Date),
				undefined,
				expect.any(Date),
			);
			expect(
				vi
					.mocked(recordCronJobRun)
					.mock.calls.every((call) => call[0] !== "webhook-retry"),
			).toBe(true);
		} finally {
			vi.useRealTimers();
		}
	});

	it("runs a */5 job whose last run was 10 min ago", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2025, 5, 15, 12, 7, 0));
		try {
			vi.mocked(getCronJobRun).mockImplementation(
				(jobKey: string) =>
					Promise.resolve(
						jobKey === "webhook-retry"
							? { lastRunAt: new Date(2025, 5, 15, 11, 57, 0) } // 10 min ago
							: { lastRunAt: new Date() },
					) as never,
			);
			vi.mocked(processPendingDeliveries).mockClear();

			const results = await runAllJobs();

			expect(processPendingDeliveries).toHaveBeenCalledTimes(1);
			expect(results["webhook-retry"]?.processed).toBe(3);
		} finally {
			vi.useRealTimers();
		}
	});

	it("runs jobs that have never run before", async () => {
		vi.mocked(getCronJobRun).mockResolvedValue(null);
		vi.mocked(processPendingDeliveries).mockClear();

		const results = await runAllJobs();

		expect(processPendingDeliveries).toHaveBeenCalled();
		expect(results["webhook-retry"]?.success).toBe(true);
	});

	it("skips jobs disabled via cronConfig.jobs", async () => {
		cronConfig.jobs.webhookRetry = false;
		try {
			vi.mocked(processPendingDeliveries).mockClear();
			const results = await runAllJobs();
			expect(results["webhook-retry"]).toEqual({
				success: true,
				processed: 0,
				errors: [],
			});
			expect(processPendingDeliveries).not.toHaveBeenCalled();
		} finally {
			cronConfig.jobs.webhookRetry = true;
		}
	});

	it("keeps running other jobs when one throws", async () => {
		vi.mocked(processPendingDeliveries).mockRejectedValueOnce(
			new Error("boom"),
		);
		const results = await runAllJobs();
		expect(results["webhook-retry"]?.success).toBe(false);
		expect(results["webhook-retry"]?.errors).toContain("boom");
		expect(results["audit-log-cleanup"]?.success).toBe(true);
	});

	it("skips a due job whose claim is lost to a concurrent trigger", async () => {
		vi.mocked(claimCronJobRun).mockResolvedValueOnce(false);
		vi.mocked(processPendingDeliveries).mockClear();

		const results = await runAllJobs();

		expect(results["webhook-retry"]).toEqual({
			success: true,
			processed: 0,
			errors: [],
			skipped: true,
		});
		expect(processPendingDeliveries).not.toHaveBeenCalled();
	});

	it("skips a due job when the claim write fails (fail-closed)", async () => {
		vi.mocked(claimCronJobRun).mockRejectedValueOnce(new Error("db down"));
		vi.mocked(processPendingDeliveries).mockClear();

		const results = await runAllJobs();

		expect(results["webhook-retry"]).toEqual({
			success: true,
			processed: 0,
			errors: [],
			skipped: true,
		});
		expect(processPendingDeliveries).not.toHaveBeenCalled();
	});

	it("records a job's skipped result with status skipped", async () => {
		const runner = new InlineJobRunner([
			makeRunnerJob(
				"skip-me",
				vi.fn().mockResolvedValue({ ...DONE, processed: 0, skipped: true }),
			),
		]);
		vi.mocked(recordCronJobRun).mockClear();

		await runner.run("skip-me");

		expect(recordCronJobRun).toHaveBeenCalledWith(
			"skip-me",
			"skipped",
			expect.any(Date),
			undefined,
			undefined,
		);
	});

	it("claims a due job against the observed lastRunAt", async () => {
		const lastRunAt = new Date(2025, 5, 5, 0, 0, 0);
		vi.mocked(getCronJobRun).mockResolvedValue({ lastRunAt } as never);
		vi.mocked(claimCronJobRun).mockClear();

		await runAllJobs();

		expect(claimCronJobRun).toHaveBeenCalledWith(
			"webhook-retry",
			lastRunAt,
			expect.any(Date),
		);
	});

	it("fails open when run state is unreadable — runs without claiming", async () => {
		vi.mocked(getCronJobRun).mockRejectedValue(new Error("db down"));
		vi.mocked(claimCronJobRun).mockClear();
		vi.mocked(processPendingDeliveries).mockClear();
		try {
			const results = await runAllJobs();
			expect(processPendingDeliveries).toHaveBeenCalled();
			expect(results["webhook-retry"]?.success).toBe(true);
			// No claim possible without a readable lastRunAt — documented
			// fail-open means the job runs unclaimed rather than not at all.
			expect(claimCronJobRun).not.toHaveBeenCalled();
		} finally {
			vi.mocked(getCronJobRun).mockResolvedValue(null);
		}
	});

	it("still returns the result when recording the run fails", async () => {
		vi.mocked(recordCronJobRun).mockRejectedValueOnce(new Error("db down"));
		const results = await runAllJobs();
		expect(results["webhook-retry"]?.success).toBe(true);
	});
});

describe("in-flight guard", () => {
	it("rejects a force-run while the same job is already running", async () => {
		const d = deferred();
		const run = vi.fn(() => d.promise);
		const runner = new InlineJobRunner([makeRunnerJob("slow", run)]);

		const first = runner.run("slow");
		const second = await runner.run("slow");

		expect(second).toEqual({
			success: false,
			processed: 0,
			errors: ['job "slow" is already running'],
		});
		expect(run).toHaveBeenCalledTimes(1);

		d.resolve(DONE);
		expect((await first).success).toBe(true);
	});

	it("skips an in-flight job in runAll without claiming", async () => {
		const d = deferred();
		const runner = new InlineJobRunner([
			makeRunnerJob(
				"slow",
				vi.fn(() => d.promise),
			),
		]);
		vi.mocked(claimCronJobRun).mockClear();

		const first = runner.run("slow");
		const results = await runner.runAll();

		expect(results.slow).toEqual({
			success: true,
			processed: 0,
			errors: [],
			skipped: true,
		});
		expect(claimCronJobRun).not.toHaveBeenCalled();

		d.resolve(DONE);
		await first;
	});

	it("keeps blocking overlaps until the job promise settles, not the race timeout", async () => {
		vi.useFakeTimers();
		const d = deferred();
		const runner = new InlineJobRunner([
			makeRunnerJob(
				"slow",
				vi.fn(() => d.promise),
			),
		]);
		try {
			const first = runner.run("slow");
			// Past the per-job timeout — the run reports failure, but the
			// underlying promise is still pending (zombie execution).
			await vi.advanceTimersByTimeAsync(6 * 60_000);
			expect((await first).success).toBe(false);

			const overlap = await runner.run("slow");
			expect(overlap.errors[0]).toBe('job "slow" is already running');

			d.resolve(DONE);
			// Let the job promise's own finally remove the guard.
			await vi.advanceTimersByTimeAsync(0);
			const after = await runner.run("slow");
			expect(after.success).toBe(true);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("listJobs", () => {
	it("returns all registered jobs", () => {
		const jobs = listJobs();
		expect(jobs.length).toBe(4);
		expect(jobs.map((j) => j.name)).toEqual(
			expect.arrayContaining([
				"webhook-retry",
				"audit-log-cleanup",
				"subscription-reminder",
				"telemetry-ping",
			]),
		);
	});
});
