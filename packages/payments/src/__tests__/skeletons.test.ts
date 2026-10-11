import { describe, expect, it } from "vitest";
import { noopPaymentProvider } from "../providers/skeletons";
import { testPaymentProviderContract } from "./provider-contract.test";

testPaymentProviderContract("noop", () => noopPaymentProvider, {
	behavior: "throws",
	throwsContains: "not implemented",
});

describe("noop skeleton — id is noop", () => {
	it("has id 'noop'", () => {
		expect(noopPaymentProvider.id).toBe("noop");
	});
});
