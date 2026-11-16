import { describe, expect, it } from "vitest";
import {
	failureKindForStatus,
	isProviderRequestError,
	ProviderRequestError,
} from "../types";

describe("failureKindForStatus", () => {
	it.each([
		[404, "not_found"],
		[409, "invalid_state"],
		[429, "unavailable"],
		[500, "unavailable"],
		[503, "unavailable"],
		[undefined, "unavailable"],
		[0, "unavailable"],
		[400, "rejected"],
		[402, "rejected"],
		[422, "rejected"],
	] as const)("HTTP %s is %s", (status, kind) => {
		expect(failureKindForStatus(status)).toBe(kind);
	});
});

describe("isProviderRequestError", () => {
	it("recognises the error by name and kind, also from another bundle", () => {
		expect(
			isProviderRequestError(new ProviderRequestError("x", "not_found")),
		).toBe(true);
		const copy = Object.assign(new Error("x"), {
			name: "ProviderRequestError",
			kind: "unavailable",
		});
		expect(isProviderRequestError(copy)).toBe(true);
	});

	it("rejects other errors and look-alikes without a kind", () => {
		expect(isProviderRequestError(new Error("x"))).toBe(false);
		expect(
			isProviderRequestError(
				Object.assign(new Error("x"), { name: "ProviderRequestError" }),
			),
		).toBe(false);
		expect(
			isProviderRequestError({ name: "ProviderRequestError", kind: "x" }),
		).toBe(false);
	});
});
