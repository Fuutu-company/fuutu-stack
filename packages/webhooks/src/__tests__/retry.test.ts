import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateNextRetry } from "../retry";

describe("calculateNextRetry", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns a future date", () => {
		const result = calculateNextRetry(0);
		expect(result.getTime()).toBeGreaterThan(Date.now() - 1000);
	});

	it("uses exponential backoff with jitter: delay in [2^attempt * base * 0.5, 2^attempt * base]", () => {
		const before = Date.now();
		const result = calculateNextRetry(3);
		const expectedMs = before + 2 ** 3 * 1000;
		expect(result.getTime()).toBeGreaterThanOrEqual(expectedMs / 2);
		expect(result.getTime()).toBeLessThanOrEqual(expectedMs + 1000);
	});

	it("applies jitter deterministically when randomness is fixed", () => {
		vi.spyOn(Math, "random").mockReturnValue(0.5);
		const before = Date.now();
		const result = calculateNextRetry(2);
		// equal jitter: delay * (0.5 + 0.5*0.5) = delay * 0.75
		const expectedMs = before + 2 ** 2 * 1000 * 0.75;
		expect(result.getTime()).toBeGreaterThanOrEqual(expectedMs - 100);
		expect(result.getTime()).toBeLessThanOrEqual(expectedMs + 100);
	});

	it("caps delay at 1 hour", () => {
		const before = Date.now();
		const result = calculateNextRetry(20);
		const maxMs = before + 60 * 60 * 1000;
		expect(result.getTime()).toBeLessThanOrEqual(maxMs + 1000);
	});

	it("increases delay with higher attempt numbers", () => {
		vi.spyOn(Math, "random").mockReturnValue(0.5);
		const r0 = calculateNextRetry(0).getTime();
		const r1 = calculateNextRetry(1).getTime();
		const r2 = calculateNextRetry(2).getTime();
		expect(r1).toBeGreaterThan(r0);
		expect(r2).toBeGreaterThan(r1);
	});
});
