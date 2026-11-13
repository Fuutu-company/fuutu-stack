import { describe, expect, it } from "vitest";
import { usagePercent } from "../features";

describe("usagePercent", () => {
	it("reports unlimited limits without a percentage", () => {
		expect(usagePercent(12, "unlimited")).toEqual({ kind: "unlimited" });
	});

	it("reports a disabled limit as unavailable on the plan", () => {
		expect(usagePercent(0, false)).toEqual({ kind: "unavailable" });
	});

	it("returns used/limit as a rounded percentage", () => {
		expect(usagePercent(3, 10)).toEqual({ kind: "percent", value: 30 });
		expect(usagePercent(1, 3)).toEqual({ kind: "percent", value: 33 });
	});

	it("returns 0 for no usage", () => {
		expect(usagePercent(0, 10)).toEqual({ kind: "percent", value: 0 });
	});

	it("clamps over-limit usage to 100", () => {
		expect(usagePercent(25, 10)).toEqual({ kind: "percent", value: 100 });
	});

	it("treats a zero limit as full when used, empty otherwise", () => {
		expect(usagePercent(2, 0)).toEqual({ kind: "percent", value: 100 });
		expect(usagePercent(0, 0)).toEqual({ kind: "percent", value: 0 });
	});

	it("never goes below 0 for negative usage", () => {
		expect(usagePercent(-5, 10)).toEqual({ kind: "percent", value: 0 });
	});
});
