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
	recordCronJobRun: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@fuutu/payments/config", () => ({
	LIMITS: {
		free: { auditLogDays: false },
		pro: { auditLogDays: 30 },
		enterprise: { auditLogDays: "unlimited" },
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

import { getCronJobRun, recordCronJobRun } from "@fuutu/db";
import { processPendingDeliveries } from "@fuutu/webhooks";
import { cronConfig } from "../config";
import { listJobs, runAllJobs, runJob } from "../runner";

const ALL_JOBS = [
	"webhook-retry",
	"audit-log-cleanup",
	"subscription-reminder",
	"telemetry-ping",
];

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
		);
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
