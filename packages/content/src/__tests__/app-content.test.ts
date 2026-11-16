import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";
import { applyAppContent, applyAppLegal } from "../content-extensions";
import type { LegalDocument, PostEntry } from "../index";

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

describe("applyAppLegal", () => {
	const KitPrivacy: ComponentType = () => null;
	const KitPrivacyDe: ComponentType = () => null;
	const KitTerms: ComponentType = () => null;
	const AppBody: ComponentType = () => null;

	const doc = (
		slug: string,
		locale: string,
		body: ComponentType = AppBody,
		updatedAt = "2026-11-01",
	): LegalDocument => ({
		slug,
		locale,
		frontmatter: { title: `${slug} (${locale})`, updatedAt },
		body,
	});

	const kit = () => ({
		privacy: {
			en: doc("privacy", "en", KitPrivacy),
			de: doc("privacy", "de", KitPrivacyDe),
		},
		terms: { en: doc("terms", "en", KitTerms) },
	});

	it("keeps the kit documents without app legal documents", () => {
		expect(applyAppLegal(kit(), undefined)).toEqual(kit());
		expect(applyAppLegal(kit(), [])).toEqual(kit());
	});

	it("an app legal document replaces the kit one for its slug and locale", () => {
		const result = applyAppLegal(kit(), [doc("privacy", "en")]);
		expect(result.privacy?.en?.body).toBe(AppBody);
		// The other locale of the slug and the other slugs stay the kit's.
		expect(result.privacy?.de?.body).toBe(KitPrivacyDe);
		expect(result.terms?.en?.body).toBe(KitTerms);
	});

	it("a new slug is published", () => {
		const result = applyAppLegal(kit(), [
			doc("telemetry", "en"),
			doc("telemetry", "de"),
		]);
		expect(Object.keys(result)).toEqual(["privacy", "terms", "telemetry"]);
		expect(result.telemetry?.de).toMatchObject({
			slug: "telemetry",
			locale: "de",
		});
	});

	it("a new locale for a kit slug is added next to the kit ones", () => {
		const result = applyAppLegal(kit(), [doc("terms", "de")]);
		expect(result.terms?.en?.body).toBe(KitTerms);
		expect(result.terms?.de?.body).toBe(AppBody);
	});

	it("invalid frontmatter throws", () => {
		expect(() =>
			applyAppLegal(kit(), [doc("privacy", "en", AppBody, "not-a-date")]),
		).toThrow();
		expect(() =>
			applyAppLegal(kit(), [
				{
					...doc("privacy", "en"),
					frontmatter: { title: "", updatedAt: "2026-11-01" },
				},
			]),
		).toThrow();
	});

	it("a slug that is not URL-safe throws", () => {
		for (const slug of ["", "Privacy", "../etc", "a b"]) {
			expect(() => applyAppLegal(kit(), [doc(slug, "en")]), slug).toThrow(
				/slug/,
			);
		}
	});

	it("two app documents for one slug and locale throw", () => {
		expect(() =>
			applyAppLegal(kit(), [doc("telemetry", "en"), doc("telemetry", "en")]),
		).toThrow(/telemetry/);
	});

	it("does not mutate the kit registry", () => {
		const registry = kit();
		applyAppLegal(registry, [doc("privacy", "en"), doc("telemetry", "en")]);
		expect(registry).toEqual(kit());
	});
});
