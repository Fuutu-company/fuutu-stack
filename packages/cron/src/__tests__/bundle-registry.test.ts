import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CronJob } from "../types";

/**
 * Next.js may evaluate @fuutu/cron once per bundle (instrumentation, the
 * /api/cron route). A job registered in one bundle must be visible to the
 * runner in another — `vi.resetModules()` + re-import simulates a second
 * bundle evaluating the package.
 */

vi.mock("@fuutu/webhooks", () => ({ processPendingDeliveries: vi.fn() }));

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

vi.mock("@fuutu/telemetry", () => ({ pingTelemetry: vi.fn() }));

const appJob = vi.hoisted(() => ({
	name: "app-usage-rollup",
	schedule: "0 * * * *",
	enabled: true,
	run: async () => ({ success: true, processed: 3, errors: [] }),
}));
const appOverride = vi.hoisted(() => ({
	name: "audit-log-cleanup",
	schedule: "0 4 * * *",
	enabled: true,
	run: async () => ({ success: true, processed: 0, errors: [] }),
}));
vi.mock("../app-jobs", () => ({ appJobs: [appJob, appOverride] }));

const REGISTRY_KEY = Symbol.for("fuutu.cron.jobs");

function makeJob(overrides: Partial<CronJob> = {}): CronJob {
	return {
		name: "instrumentation-job",
		schedule: "* * * * *",
		enabled: true,
		run: vi.fn().mockResolvedValue({ success: true, processed: 7, errors: [] }),
		...overrides,
	};
}

const loadBundle = async () => {
	vi.resetModules();
	return import("../index");
};

const countByName = (jobs: readonly CronJob[], name: string) =>
	jobs.filter((j) => j.name === name).length;

beforeEach(() => {
	Reflect.deleteProperty(globalThis, REGISTRY_KEY);
});

describe("cron registry across bundles", () => {
	it("a job registered in one bundle runs in another", async () => {
		const instrumentation = await loadBundle();
		const job = makeJob();
		instrumentation.registerJob(job);

		const route = await loadBundle();
		expect(route.listJobs()).toContain(job);
		const result = await route.runJob("instrumentation-job");
		expect(result.processed).toBe(7);
		expect(job.run).toHaveBeenCalledTimes(1);
	});

	it("a built-in override from one bundle survives another bundle loading", async () => {
		const instrumentation = await loadBundle();
		const override = makeJob({ name: "webhook-retry" });
		instrumentation.registerJob(override);

		const route = await loadBundle();
		const matches = route.allJobs.filter((j) => j.name === "webhook-retry");
		expect(matches).toEqual([override]);
	});

	it("does not re-register app jobs over a runtime override on later loads", async () => {
		const instrumentation = await loadBundle();
		const override = makeJob({ name: "app-usage-rollup" });
		instrumentation.registerJob(override);

		const route = await loadBundle();
		expect(route.allJobs.filter((j) => j.name === "app-usage-rollup")).toEqual([
			override,
		]);
	});

	it("keeps built-ins and app jobs exactly once after several loads", async () => {
		await loadBundle();
		await loadBundle();
		const third = await loadBundle();

		expect(countByName(third.allJobs, "webhook-retry")).toBe(1);
		expect(countByName(third.allJobs, "app-usage-rollup")).toBe(1);
		expect(third.allJobs.filter((j) => j.name === "audit-log-cleanup")).toEqual(
			[appOverride],
		);
		expect(third.allJobs.map((j) => j.name)).toEqual([
			"webhook-retry",
			"audit-log-cleanup",
			"subscription-reminder",
			"telemetry-ping",
			"oauth-client-cleanup",
			"app-usage-rollup",
		]);
	});
});
