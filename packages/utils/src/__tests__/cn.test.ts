import { describe, expect, it } from "vitest";
import { cn } from "../cn";

describe("cn", () => {
	it("joins class names", () => {
		expect(cn("px-2", "py-1")).toBe("px-2 py-1");
	});

	it("drops falsy inputs", () => {
		expect(cn("px-2", false, undefined, null, "py-1")).toBe("px-2 py-1");
	});

	it("supports conditional object syntax", () => {
		expect(cn("base", { active: true, hidden: false })).toBe("base active");
	});

	it("later conflicting Tailwind utilities win", () => {
		expect(cn("px-2", "px-4")).toBe("px-4");
		expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
	});

	it("keeps non-conflicting utilities", () => {
		expect(cn("px-2", "py-4")).toBe("px-2 py-4");
	});

	it("returns empty string for no classes", () => {
		expect(cn()).toBe("");
	});
});
