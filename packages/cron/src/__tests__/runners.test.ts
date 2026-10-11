import { describe, expect, it } from "vitest";
import { cronConfig } from "../config";
import { resolveJobRunner } from "../runner";
import { InlineJobRunner } from "../runners/inline";
import { TriggerDevJobRunner } from "../runners/trigger-dev";
import type { JobRunner } from "../types";

describe("resolveJobRunner", () => {
	it("returns InlineJobRunner by default", () => {
		const runner = resolveJobRunner();
		expect(runner).toBeInstanceOf(InlineJobRunner);
		expect(runner.id).toBe("inline");
	});

	it("returns the runner matching cronConfig.runner", () => {
		const runner = resolveJobRunner();
		expect(runner.id).toBe(cronConfig.runner);
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
