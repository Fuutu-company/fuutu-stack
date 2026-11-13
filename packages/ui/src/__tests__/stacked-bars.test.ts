import { describe, expect, it } from "vitest";
import { buildStackedBars } from "../lib/stacked-bars";

const KEYS = ["users", "billing", "ai", "api"] as const;
const row = (users = 0, billing = 0, ai = 0, api = 0) => ({
	users,
	billing,
	ai,
	api,
});

describe("buildStackedBars", () => {
	it("totals each bar and reports the grand total", () => {
		const chart = buildStackedBars([row(1, 2), row(0, 0, 3, 4)], KEYS);
		expect(chart.bars.map((b) => b.total)).toEqual([3, 7]);
		expect(chart.total).toBe(10);
	});

	it("scales the tallest bar to 100% and the rest proportionally", () => {
		const chart = buildStackedBars([row(5), row(10), row(0)], KEYS);
		expect(chart.bars.map((b) => b.pct)).toEqual([50, 100, 0]);
		expect(chart.max).toBe(10);
	});

	it("stacks segments in key order with heights relative to the tallest bar", () => {
		const chart = buildStackedBars([row(2, 3), row(10)], KEYS);
		expect(chart.bars[0]?.segments).toEqual([
			{ key: "users", value: 2, pct: 20 },
			{ key: "billing", value: 3, pct: 30 },
		]);
	});

	it("omits zero-value segments", () => {
		const chart = buildStackedBars([row(0, 0, 4)], KEYS);
		expect(chart.bars[0]?.segments.map((s) => s.key)).toEqual(["ai"]);
	});

	it("reports the busiest bar (first on ties) or -1 when empty of events", () => {
		expect(buildStackedBars([row(1), row(5), row(5)], KEYS).peakIndex).toBe(1);
		const flat = buildStackedBars([row(), row()], KEYS);
		expect(flat.peakIndex).toBe(-1);
		expect(flat.bars.map((b) => b.pct)).toEqual([0, 0]);
	});

	it("handles empty input", () => {
		expect(buildStackedBars([], KEYS)).toEqual({
			bars: [],
			max: 0,
			total: 0,
			peakIndex: -1,
		});
	});
});
