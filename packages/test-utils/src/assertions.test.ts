import { describe, expect, it } from "vitest";
import { expectRejects, expectResolves } from "./assertions";

describe("expectRejects", () => {
	it("passes when the promise rejects with an Error", async () => {
		await expectRejects(Promise.reject(new Error("boom")));
	});

	it("passes when the promise rejects with undefined", async () => {
		await expectRejects(Promise.reject(undefined));
	});

	it("passes when the promise rejects with a non-Error value", async () => {
		await expectRejects(Promise.reject("boom"));
	});

	it("matches the rejection message substring", async () => {
		await expectRejects(
			Promise.reject(new Error("rate limit exceeded")),
			"rate limit",
		);
	});

	it("fails when the promise resolves", async () => {
		await expect(expectRejects(Promise.resolve("ok"))).rejects.toThrow();
	});
});

describe("expectResolves", () => {
	it("passes when the promise resolves", async () => {
		await expectResolves(Promise.resolve("ok"));
	});

	it("accepts a thunk", async () => {
		await expectResolves(() => Promise.resolve("ok"));
	});
});
