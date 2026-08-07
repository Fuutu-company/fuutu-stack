import { describe, expect, it } from "vitest";
import { invariant } from "../invariant";

describe("invariant", () => {
	it("does not throw when condition is truthy", () => {
		expect(() => invariant(true)).not.toThrow();
	});

	it("does not throw for truthy non-boolean condition", () => {
		expect(() => invariant("hello")).not.toThrow();
		expect(() => invariant(1)).not.toThrow();
		expect(() => invariant({})).not.toThrow();
	});

	it("throws default message when condition is falsy", () => {
		expect(() => invariant(false)).toThrow("Invariant failed");
	});

	it("throws for falsy non-boolean condition", () => {
		expect(() => invariant(0)).toThrow();
		expect(() => invariant("")).toThrow();
		expect(() => invariant(null)).toThrow();
		expect(() => invariant(undefined)).toThrow();
	});

	it("throws custom error message", () => {
		expect(() => invariant(false, "Custom error message")).toThrow(
			"Custom error message",
		);
	});

	it("throws an Error instance", () => {
		expect(() => invariant(false)).toThrow(Error);
	});
});
