import { describe, expect, it } from "vitest";
import { calculateNextRetry } from "../retry";

describe("calculateNextRetry", () => {
	it("returns a future date", () => {
		const result = calculateNextRetry(0);
		expect(result.getTime()).toBeGreaterThan(Date.now() - 1000);
	});

	it("uses exponential backoff: 2^attempt * baseDelay", () => {
		const before = Date.now();
		const result = calculateNextRetry(3);
		const expectedMs = before + 2 ** 3 * 1000;
		// Allow small clock skew
		expect(result.getTime()).toBeGreaterThanOrEqual(expectedMs - 100);
		expect(result.getTime()).toBeLessThanOrEqual(expectedMs + 1000);
	});

	it("caps delay at 1 hour", () => {
		const before = Date.now();
		const result = calculateNextRetry(20);
		const maxMs = before + 60 * 60 * 1000;
		expect(result.getTime()).toBeLessThanOrEqual(maxMs + 1000);
	});

	it("increases delay with higher attempt numbers", () => {
		const r0 = calculateNextRetry(0).getTime();
		const r1 = calculateNextRetry(1).getTime();
		const r2 = calculateNextRetry(2).getTime();
		expect(r1).toBeGreaterThan(r0);
		expect(r2).toBeGreaterThan(r1);
	});
});
