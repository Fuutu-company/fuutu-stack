import { describe, expect, it } from "vitest";
import {
	cronMatches,
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

	it("rejects silently-truncated and partially-numeric fields", () => {
		// Extra step segment must not be dropped.
		expect(() => parseCronExpression("*/2/3 * * * *")).toThrow();
		// parseInt("5abc") === 5 — a strict parser must reject this.
		expect(() => parseCronExpression("5abc * * * *")).toThrow();
		expect(() => parseCronExpression("1-2x * * * *")).toThrow();
		// Extra range segment must not be dropped.
		expect(() => parseCronExpression("1-2-3 * * * *")).toThrow();
	});

	it("normalizes day-of-week 7 to Sunday (0)", () => {
		const parsed = parseCronExpression("0 9 * * 7");
		expect(parsed.dayOfWeek.has(0)).toBe(true);
		expect(parsed.dayOfWeek.has(7)).toBe(false);
	});

	it("anchors a bare N/step at N through the field max", () => {
		const parsed = parseCronExpression("5/15 * * * *");
		expect([...parsed.minute].sort((a, b) => a - b)).toEqual([5, 20, 35, 50]);
	});

	it("steps within an explicit range", () => {
		const parsed = parseCronExpression("1-5/2 * * * *");
		expect([...parsed.minute].sort((a, b) => a - b)).toEqual([1, 3, 5]);
	});

	it("treats */n in dom/dow as restricted for the OR rule", () => {
		const parsed = parseCronExpression("0 9 */2 * */3");
		expect(parsed.dayOfMonthAny).toBe(false);
		expect(parsed.dayOfWeekAny).toBe(false);
	});

	it("rejects empty list items, reversed ranges, and named fields", () => {
		expect(() => parseCronExpression("1,,2 * * * *")).toThrow();
		expect(() => parseCronExpression("5-1 * * * *")).toThrow();
		expect(() => parseCronExpression("0 9 * * MON")).toThrow();
		expect(() => parseCronExpression("0 9 * JAN *")).toThrow();
	});
});

describe("cronMatches", () => {
	// 2025-06-01 was a Sunday; 2025-06-04 a Wednesday; 2025-05-01 a Thursday.
	it("applies the dom/dow OR rule when both fields are restricted", () => {
		const parsed = parseCronExpression("0 9 1 * 3");
		// Wednesday but not the 1st — matches via day-of-week.
		expect(cronMatches(parsed, new Date(2025, 5, 4, 9, 0))).toBe(true);
		// The 1st but not a Wednesday — matches via day-of-month.
		expect(cronMatches(parsed, new Date(2025, 4, 1, 9, 0))).toBe(true);
		// Neither the 1st nor a Wednesday — no match.
		expect(cronMatches(parsed, new Date(2025, 5, 2, 9, 0))).toBe(false);
	});

	it("requires both fields when only one is restricted", () => {
		const parsed = parseCronExpression("0 9 1 * *");
		expect(cronMatches(parsed, new Date(2025, 5, 1, 9, 0))).toBe(true);
		expect(cronMatches(parsed, new Date(2025, 5, 4, 9, 0))).toBe(false);
	});

	it("treats day-of-week 7 the same as 0 (Sunday)", () => {
		const sunday = new Date(2025, 5, 1, 9, 0);
		expect(cronMatches(parseCronExpression("0 9 * * 7"), sunday)).toBe(true);
		expect(cronMatches(parseCronExpression("0 9 * * 0"), sunday)).toBe(true);
	});

	it("applies the dom/dow OR rule for stepped fields", () => {
		// "*/2" dom = odd days; "*/3" dow = {0,3,6}.
		const parsed = parseCronExpression("0 9 */2 * */3");
		// Wednesday (dow 3) on an even dom — matches via day-of-week.
		expect(cronMatches(parsed, new Date(2025, 5, 4, 9, 0))).toBe(true);
		// Thursday (dow 4) on an odd dom — matches via day-of-month.
		expect(cronMatches(parsed, new Date(2025, 5, 5, 9, 0))).toBe(true);
		// Friday (dow 5) on an even dom — no match.
		expect(cronMatches(parsed, new Date(2025, 5, 6, 9, 0))).toBe(false);
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

	it("fails closed on a parseable but impossible schedule", () => {
		// "31 February" parses but matches no real instant — an empty
		// lookback proves the schedule can never fire.
		expect(isJobDue("0 0 31 2 *", new Date(2025, 0, 1), now)).toBe(false);
	});
});
