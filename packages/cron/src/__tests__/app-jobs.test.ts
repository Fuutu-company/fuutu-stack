import { describe, expect, it, vi } from "vitest";

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
	claimCronJobRun: vi.fn().mockResolvedValue(true),
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

// App-owned jobs (`../app-jobs`) join the registry like built-ins.
const appJob = vi.hoisted(() => ({
	name: "app-usage-rollup",
	schedule: "0 * * * *",
	enabled: true,
	run: vi.fn(async () => ({ success: true, processed: 3, errors: [] })),
}));
const appOverride = vi.hoisted(() => ({
	name: "audit-log-cleanup",
	schedule: "0 4 * * *",
	enabled: true,
	run: vi.fn(async () => ({ success: true, processed: 0, errors: [] })),
}));

vi.mock("../app-jobs", () => ({ appJobs: [appJob, appOverride] }));

const { allJobs, listJobs, runJob } = await import("../index");

describe("app-owned jobs", () => {
	it("are registered next to the built-in jobs", () => {
		expect(listJobs()).toContain(appJob);
		expect(listJobs().map((j) => j.name)).toContain("webhook-retry");
	});

	it("run through the kit runner", async () => {
		const result = await runJob("app-usage-rollup");
		expect(result.processed).toBe(3);
		expect(appJob.run).toHaveBeenCalledTimes(1);
	});

	it("replace a built-in job with the same name (warned)", () => {
		const matches = allJobs.filter((j) => j.name === "audit-log-cleanup");
		expect(matches).toEqual([appOverride]);
		expect(logMocks.warn).toHaveBeenCalledWith(
			"registerJob replacing existing job",
			expect.objectContaining({ job: "audit-log-cleanup" }),
		);
	});
});
