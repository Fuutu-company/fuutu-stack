import { afterEach, describe, expect, it, vi } from "vitest";

const logMocks = vi.hoisted(() => ({
	debug: vi.fn(),
	error: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
}));

vi.mock("@fuutu/logs", () => ({
	createLogger: () => logMocks,
}));

vi.mock("@fuutu/webhooks", () => ({
	processPendingDeliveries: vi.fn(),
}));

vi.mock("@fuutu/db", () => ({
	deleteAuditLogsBefore: vi.fn(),
	getTrialingSubscriptions: vi.fn(),
	notificationExists: vi.fn(),
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
	getMessagesForLocale: vi.fn().mockResolvedValue({}),
}));

vi.mock("@fuutu/notifications", () => ({
	resolveNotificationProvider: vi.fn(() => ({
		id: "test",
		notify: vi.fn().mockResolvedValue(undefined),
	})),
}));

vi.mock("@fuutu/telemetry", () => ({
	pingTelemetry: vi.fn(),
}));

import { cronConfig } from "../config";
import {
	allJobs,
	listJobs,
	registerJob,
	resolveJobRunner,
	runJob,
} from "../index";
import type { CronJob } from "../types";

// Jobs registered by a test are removed again afterwards so the registry
// stays isolated between tests.
const registeredNames = new Set<string>();
afterEach(() => {
	for (let i = allJobs.length - 1; i >= 0; i--) {
		const job = allJobs[i];
		if (job && registeredNames.has(job.name)) {
			allJobs.splice(i, 1);
		}
	}
	registeredNames.clear();
});

function registerTracked(job: CronJob): void {
	registeredNames.add(job.name);
	registerJob(job);
}

function makeJob(overrides: Partial<CronJob> = {}): CronJob {
	return {
		name: "test-custom",
		schedule: "* * * * *",
		enabled: true,
		run: vi.fn().mockResolvedValue({ success: true, processed: 1, errors: [] }),
		...overrides,
	};
}

describe("registerJob", () => {
	it("appends a custom job to the registry", () => {
		const job = makeJob();
		registerTracked(job);
		expect(listJobs()).toContain(job);
	});

	it("replaces an existing job with the same name (idempotent)", () => {
		const first = makeJob();
		const second = makeJob();
		registerTracked(first);
		registerTracked(second);
		const matches = allJobs.filter((j) => j.name === "test-custom");
		expect(matches).toHaveLength(1);
		expect(matches[0]).toBe(second);
	});

	it("warns when replacing an existing job name", () => {
		logMocks.warn.mockClear();
		registerTracked(makeJob());
		registerTracked(makeJob());
		expect(logMocks.warn).toHaveBeenCalledWith(
			"registerJob replacing existing job",
			expect.objectContaining({ job: "test-custom" }),
		);
	});

	it("warns when overriding a built-in job", () => {
		const original = allJobs.find((j) => j.name === "webhook-retry");
		logMocks.warn.mockClear();
		try {
			registerJob(makeJob({ name: "webhook-retry" }));
			expect(logMocks.warn).toHaveBeenCalledWith(
				"registerJob replacing existing job",
				expect.objectContaining({ job: "webhook-retry" }),
			);
		} finally {
			const i = allJobs.findIndex((j) => j.name === "webhook-retry");
			if (original && i >= 0) {
				allJobs[i] = original;
			}
		}
	});

	it("logs an error for an invalid schedule but still registers", () => {
		const job = makeJob({ name: "test-bad-schedule", schedule: "bogus" });
		logMocks.error.mockClear();
		registerTracked(job);
		expect(logMocks.error).toHaveBeenCalledWith(
			"invalid cron schedule — job will run on every trigger",
			expect.objectContaining({
				job: "test-bad-schedule",
				schedule: "bogus",
			}),
		);
		expect(listJobs()).toContain(job);
	});

	it("is visible to a runner constructed before registration", async () => {
		const runner = resolveJobRunner();
		const job = makeJob();
		registerTracked(job);
		const result = await runner.run("test-custom");
		expect(result.success).toBe(true);
		expect(result.processed).toBe(1);
		expect(job.run).toHaveBeenCalledTimes(1);
	});
});

describe("custom job enabled toggle", () => {
	it("skips a registered job whose enabled flag is false", async () => {
		const job = makeJob({ enabled: false });
		registerTracked(job);
		const result = await runJob("test-custom");
		expect(result.success).toBe(false);
		expect(result.errors[0]).toContain("disabled");
		expect(job.run).not.toHaveBeenCalled();
	});

	it("honors cronConfig.jobs slots for custom job names", async () => {
		try {
			cronConfig.jobs["test-custom"] = false;
			const job = makeJob({
				get enabled() {
					return cronConfig.jobs["test-custom"] ?? true;
				},
			});
			registerTracked(job);
			const result = await runJob("test-custom");
			expect(result.success).toBe(false);
			expect(result.errors[0]).toContain("disabled");
			expect(job.run).not.toHaveBeenCalled();
		} finally {
			delete cronConfig.jobs["test-custom"];
		}
	});
});
