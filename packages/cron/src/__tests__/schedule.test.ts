import { describe, expect, it } from "vitest";
import {
	isJobDue,
	parseCronExpression,
	previousScheduledRun,
} from "../schedule";

describe("parseCronExpression", () => {
	it("parses step expressions", () => {
		const parsed = parseCronExpression("*/5 * * * *");
		expect(parsed.minute.has(0)).toBe(true);
		expect(parsed.minute.has(5)).toBe(true);
		expect(parsed.minute.has(55)).toBe(true);
		expect(parsed.minute.has(3)).toBe(false);
	});

	it("parses fixed values", () => {
		const parsed = parseCronExpression("0 9 * * *");
		expect(parsed.minute.has(0)).toBe(true);
		expect(parsed.minute.size).toBe(1);
		expect(parsed.hour.has(9)).toBe(true);
		expect(parsed.hour.size).toBe(1);
	});

	it("parses lists and ranges", () => {
		const parsed = parseCronExpression("0,30 9-17 * * 1-5");
		expect(parsed.minute.has(0)).toBe(true);
		expect(parsed.minute.has(30)).toBe(true);
		expect(parsed.hour.has(9)).toBe(true);
		expect(parsed.hour.has(17)).toBe(true);
		expect(parsed.hour.has(18)).toBe(false);
		expect(parsed.dayOfWeek.has(1)).toBe(true);
		expect(parsed.dayOfWeek.has(5)).toBe(true);
		expect(parsed.dayOfWeek.has(6)).toBe(false);
	});

	it("rejects malformed expressions", () => {
		expect(() => parseCronExpression("not a cron")).toThrow();
		expect(() => parseCronExpression("* * * *")).toThrow();
		expect(() => parseCronExpression("61 * * * *")).toThrow();
		expect(() => parseCronExpression("")).toThrow();
	});
});

describe("previousScheduledRun", () => {
	it("finds the most recent matching minute", () => {
		const now = new Date(2025, 5, 15, 12, 7, 30);
		const prev = previousScheduledRun("*/5 * * * *", now);
		expect(prev?.getHours()).toBe(12);
		expect(prev?.getMinutes()).toBe(5);
	});

	it("matches the current minute when due right now", () => {
		const now = new Date(2025, 5, 15, 9, 0, 0);
		const prev = previousScheduledRun("0 9 * * *", now);
		expect(prev?.getTime()).toBe(now.getTime());
	});

	it("finds yesterday's run for a daily schedule queried before it", () => {
		const now = new Date(2025, 5, 15, 8, 59, 0);
		const prev = previousScheduledRun("0 9 * * *", now);
		expect(prev?.getDate()).toBe(14);
		expect(prev?.getHours()).toBe(9);
	});
});

describe("isJobDue", () => {
	// "*/5 * * * *" queried at 12:07 — last scheduled slot is 12:05.
	const now = new Date(2025, 5, 15, 12, 7, 0);

	it("is not due when last run covers the previous slot (1 min ago)", () => {
		const lastRunAt = new Date(2025, 5, 15, 12, 6, 0);
		expect(isJobDue("*/5 * * * *", lastRunAt, now)).toBe(false);
	});

	it("is due when last run is older than the previous slot (10 min ago)", () => {
		const lastRunAt = new Date(2025, 5, 15, 11, 57, 0);
		expect(isJobDue("*/5 * * * *", lastRunAt, now)).toBe(true);
	});

	it("is due when the job never ran", () => {
		expect(isJobDue("*/5 * * * *", null, now)).toBe(true);
		expect(isJobDue("0 9 * * *", undefined, now)).toBe(true);
	});

	it("is not due for a daily job already run today", () => {
		const dailyNow = new Date(2025, 5, 15, 10, 0, 0);
		const lastRunAt = new Date(2025, 5, 15, 9, 0, 30);
		expect(isJobDue("0 9 * * *", lastRunAt, dailyNow)).toBe(false);
	});

	it("is due for a daily job last run yesterday", () => {
		const dailyNow = new Date(2025, 5, 15, 10, 0, 0);
		const lastRunAt = new Date(2025, 5, 14, 9, 0, 0);
		expect(isJobDue("0 9 * * *", lastRunAt, dailyNow)).toBe(true);
	});

	it("fails open on unparseable schedules", () => {
		expect(isJobDue("bogus", new Date(), now)).toBe(true);
	});
});
