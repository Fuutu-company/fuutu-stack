import { describe, expect, it } from "vitest";
import { insertAfter } from "../insert-after";

const key = (item: string) => item;

describe("insertAfter", () => {
	it("returns the base list unchanged without extras", () => {
		expect(insertAfter(["a", "b"], [], key)).toEqual(["a", "b"]);
	});

	it("appends extras without an anchor at the end", () => {
		expect(insertAfter(["a", "b"], [{ item: "x" }], key)).toEqual([
			"a",
			"b",
			"x",
		]);
	});

	it("places an extra directly after its anchor", () => {
		expect(
			insertAfter(["a", "b", "c"], [{ after: "a", item: "x" }], key),
		).toEqual(["a", "x", "b", "c"]);
	});

	it("keeps declaration order for several extras on one anchor", () => {
		expect(
			insertAfter(
				["a", "b"],
				[
					{ after: "a", item: "x" },
					{ after: "a", item: "y" },
				],
				key,
			),
		).toEqual(["a", "x", "y", "b"]);
	});

	it("appends an extra whose anchor is absent (e.g. gated out)", () => {
		expect(
			insertAfter(["a", "b"], [{ after: "missing", item: "x" }], key),
		).toEqual(["a", "b", "x"]);
	});

	it("can anchor on a previously placed extra", () => {
		expect(
			insertAfter(
				["a", "b"],
				[
					{ after: "a", item: "x" },
					{ after: "x", item: "y" },
				],
				key,
			),
		).toEqual(["a", "x", "y", "b"]);
	});

	it("places a later extra on an anchor before extras chained onto earlier ones", () => {
		// y anchors on the extra x; z shares x's anchor a and goes directly
		// behind x (the last extra placed on a), i.e. in front of y.
		expect(
			insertAfter(
				["a", "b"],
				[
					{ after: "a", item: "x" },
					{ after: "x", item: "y" },
					{ after: "a", item: "z" },
				],
				key,
			),
		).toEqual(["a", "x", "z", "y", "b"]);
	});

	it("appends an extra anchored on an extra declared after it", () => {
		expect(
			insertAfter(
				["a", "b"],
				[
					{ after: "y", item: "x" },
					{ after: "a", item: "y" },
				],
				key,
			),
		).toEqual(["a", "y", "b", "x"]);
	});

	it("does not mutate the base list", () => {
		const base = ["a", "b"];
		insertAfter(base, [{ after: "a", item: "x" }], key);
		expect(base).toEqual(["a", "b"]);
	});

	it("rejects an extra whose key collides with an existing item", () => {
		expect(() => insertAfter(["a", "b"], [{ item: "b" }], key)).toThrow(
			/duplicate key "b"/,
		);
	});

	it("works with object items keyed by a field", () => {
		const items = [{ id: "profile" }, { id: "done" }];
		expect(
			insertAfter(
				items,
				[{ after: "profile", item: { id: "team" } }],
				(i) => i.id,
			).map((i) => i.id),
		).toEqual(["profile", "team", "done"]);
	});
});
