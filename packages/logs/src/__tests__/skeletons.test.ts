import { describe, expect, it } from "vitest";
import { axiomProvider } from "../providers/axiom";
import { pinoProvider } from "../providers/pino";
import { testLogProviderContract } from "./provider-contract.test";

testLogProviderContract("pino", () => pinoProvider, {
	behavior: "throws",
	throwsContains: "not yet implemented",
});

testLogProviderContract("axiom", () => axiomProvider, {
	behavior: "throws",
	throwsContains: "not yet implemented",
});

describe("logs skeletons — error messages", () => {
	it("pino names the provider in the error", () => {
		expect(() => pinoProvider.log("info", "x", { scope: "s" })).toThrow(
			"pino provider not yet implemented",
		);
	});

	it("axiom names the provider in the error", () => {
		expect(() => axiomProvider.log("info", "x", { scope: "s" })).toThrow(
			"axiom provider not yet implemented",
		);
	});
});
