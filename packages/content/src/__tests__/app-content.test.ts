import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";
import { applyAppContent } from "../content-extensions";
import type { PostEntry } from "../index";

const Body: ComponentType = () => null;

const post = (
	slug: string,
	publishedAt: string,
	draft?: boolean,
): PostEntry => ({
	slug,
	frontmatter: { title: slug, publishedAt, ...(draft ? { draft } : {}) },
	bodies: { en: Body },
});

const KIT = [post("welcome", "2026-01-01"), post("roadmap", "2026-03-01")];
const slugs = (list: readonly PostEntry[]) => list.map((p) => p.slug);

describe("applyAppContent", () => {
	it("keeps the kit posts unchanged without app content", () => {
		expect(slugs(applyAppContent(KIT, {}))).toEqual(["roadmap", "welcome"]);
	});

	it("hides kit posts by slug", () => {
		expect(slugs(applyAppContent(KIT, { hidePosts: ["welcome"] }))).toEqual([
			"roadmap",
		]);
	});

	it("hides posts by predicate", () => {
		expect(
			slugs(
				applyAppContent(KIT, {
					hidePosts: (p) => p.frontmatter.publishedAt < "2026-02-01",
				}),
			),
		).toEqual(["roadmap"]);
	});

	it("can hide every post (empty blog)", () => {
		expect(applyAppContent(KIT, { hidePosts: () => true })).toEqual([]);
	});

	it("adds extra posts, newest first, with validated frontmatter", () => {
		const result = applyAppContent(KIT, {
			hidePosts: ["welcome"],
			extraPosts: [post("launch", "2026-06-01"), post("intro", "2025-12-01")],
		});
		expect(slugs(result)).toEqual(["launch", "roadmap", "intro"]);
	});

	it("rejects an extra post with invalid frontmatter", () => {
		expect(() =>
			applyAppContent(KIT, { extraPosts: [post("bad", "not-a-date")] }),
		).toThrow();
	});

	it("rejects an extra post whose slug is already taken", () => {
		expect(() =>
			applyAppContent(KIT, { extraPosts: [post("welcome", "2026-06-01")] }),
		).toThrow(/welcome/);
		// A hidden kit slug is free again.
		expect(
			slugs(
				applyAppContent(KIT, {
					hidePosts: ["welcome"],
					extraPosts: [post("welcome", "2026-06-01")],
				}),
			),
		).toEqual(["welcome", "roadmap"]);
	});

	it("hidePosts only applies to the kit posts", () => {
		expect(
			slugs(
				applyAppContent(KIT, {
					hidePosts: () => true,
					extraPosts: [post("launch", "2026-06-01")],
				}),
			),
		).toEqual(["launch"]);
	});

	it("returns a frozen collection", () => {
		expect(Object.isFrozen(applyAppContent(KIT, {}))).toBe(true);
	});
});
