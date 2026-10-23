import { describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/db", () => ({
	getCronJobRun: vi.fn().mockResolvedValue(null),
	claimCronJobRun: vi.fn().mockResolvedValue(true),
	recordCronJobRun: vi.fn().mockResolvedValue(undefined),
}));

import { cronConfig } from "../config";
import { resolveJobRunner } from "../runner";
import { InlineJobRunner } from "../runners/inline";
import { TriggerDevJobRunner } from "../runners/trigger-dev";
import type { CronJob, JobRunner } from "../types";

describe("resolveJobRunner", () => {
	it("returns InlineJobRunner by default", () => {
		const runner = resolveJobRunner();
		expect(runner).toBeInstanceOf(InlineJobRunner);
		expect(runner.id).toBe("inline");
	});

	it("returns TriggerDevJobRunner when cronConfig.runner is trigger-dev", () => {
		const spy = vi
			.spyOn(cronConfig, "runner", "get")
			.mockReturnValue("trigger-dev");
		try {
			expect(resolveJobRunner()).toBeInstanceOf(TriggerDevJobRunner);
		} finally {
			spy.mockRestore();
		}
	});

	it("throws on an out-of-union runner id", () => {
		const spy = vi
			.spyOn(cronConfig, "runner", "get")
			.mockReturnValue("bogus" as never);
		try {
			expect(() => resolveJobRunner()).toThrow("Unknown cron runner");
		} finally {
			spy.mockRestore();
		}
	});
});

describe("InlineJobRunner", () => {
	it("implements JobRunner interface", () => {
		const runner: JobRunner = new InlineJobRunner();
		expect(runner.id).toBe("inline");
		expect(typeof runner.run).toBe("function");
		expect(typeof runner.runAll).toBe("function");
		expect(typeof runner.list).toBe("function");
	});

	it("list() returns all 4 registered jobs", () => {
		const runner = new InlineJobRunner();
		const jobs = runner.list();
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

	it("fails a hung job after the per-job timeout instead of blocking forever", async () => {
		vi.useFakeTimers();
		try {
			const hung: CronJob = {
				name: "hung",
				schedule: "* * * * *",
				enabled: true,
				run: () => new Promise(() => {}),
			};
			const runner = new InlineJobRunner([hung]);
			const pending = runner.run("hung");
			// Well past any sane per-job timeout.
			await vi.advanceTimersByTimeAsync(10 * 60_000);
			const result = await pending;
			expect(result.success).toBe(false);
			expect(result.errors[0]).toContain("timed out");
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("TriggerDevJobRunner", () => {
	it("implements JobRunner interface", () => {
		const runner: JobRunner = new TriggerDevJobRunner();
		expect(runner.id).toBe("trigger-dev");
		expect(typeof runner.run).toBe("function");
		expect(typeof runner.runAll).toBe("function");
		expect(typeof runner.list).toBe("function");
	});

	it("run() throws not-implemented", async () => {
		const runner = new TriggerDevJobRunner();
		await expect(runner.run("webhook-retry")).rejects.toThrow(
			"Trigger.dev runner not implemented",
		);
	});

	it("runAll() throws not-implemented", async () => {
		const runner = new TriggerDevJobRunner();
		await expect(runner.runAll()).rejects.toThrow(
			"Trigger.dev runner not implemented",
		);
	});

	it("list() still returns all registered jobs", () => {
		const runner = new TriggerDevJobRunner();
		const jobs = runner.list();
		expect(jobs.length).toBe(4);
	});
});
