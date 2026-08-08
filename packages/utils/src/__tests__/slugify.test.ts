import { describe, expect, it } from "vitest";
import { slugify } from "../slugify";

describe("slugify", () => {
	it("lowercases normal text", () => {
		expect(slugify("Hello")).toBe("hello");
	});

	it("replaces spaces with dashes", () => {
		expect(slugify("Hello World")).toBe("hello-world");
	});

	it("replaces multiple spaces with a single dash", () => {
		expect(slugify("Hello   World")).toBe("hello-world");
	});

	it("replaces special characters with dashes", () => {
		expect(slugify("Hello! World?")).toBe("hello-world");
	});

	it("removes leading and trailing dashes", () => {
		expect(slugify("---Hello---")).toBe("hello");
	});

	it("collapses consecutive dashes", () => {
		expect(slugify("a---b")).toBe("a-b");
	});

	it("handles unicode/accents", () => {
		expect(slugify("café")).toBe("cafe");
		expect(slugify("naïve")).toBe("naive");
	});

	it("handles empty string", () => {
		expect(slugify("")).toBe("");
	});

	it("handles numbers", () => {
		expect(slugify("item 42")).toBe("item-42");
	});

	it("handles mixed alphanumeric", () => {
		expect(slugify("Post #123!")).toBe("post-123");
	});

	it("handles only special characters", () => {
		expect(slugify("!!!???")).toBe("");
	});

	it("handles mixed case with special chars and spaces", () => {
		expect(slugify("My Blog Post! #2")).toBe("my-blog-post-2");
	});
});
