import { describe, expect, it } from "vitest";
import {
	changelog,
	changelogFrontmatterSchema,
	getChangelogBody,
	getChangelogEntry,
	getLegalDocument,
	getPost,
	getPostBody,
	legal,
	legalDocumentFrontmatterSchema,
	postFrontmatterSchema,
	posts,
} from "../index";

describe("Content collections - posts", () => {
	it("exports posts array", () => {
		expect(Array.isArray(posts)).toBe(true);
	});

	it("posts array has at least one entry", () => {
		expect(posts.length).toBeGreaterThan(0);
	});

	it("each post has required fields", () => {
		for (const post of posts) {
			expect(post).toHaveProperty("slug");
			expect(post).toHaveProperty("frontmatter");
			expect(post).toHaveProperty("bodies");
			expect(typeof post.slug).toBe("string");
			expect(typeof post.frontmatter).toBe("object");
			expect(typeof post.bodies).toBe("object");
		}
	});

	it("post frontmatter has required fields", () => {
		for (const post of posts) {
			const fm = post.frontmatter;
			expect(fm).toHaveProperty("title");
			expect(fm).toHaveProperty("publishedAt");
			expect(typeof fm.title).toBe("string");
			expect(typeof fm.publishedAt).toBe("string");
		}
	});

	it("posts are sorted by publishedAt descending", () => {
		const dates = posts.map((p) =>
			new Date(p.frontmatter.publishedAt).getTime(),
		);
		for (let i = 1; i < dates.length; i++) {
			expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i] ?? 0);
		}
	});

	it("getPost returns correct post by slug", () => {
		const post = getPost("welcome");
		expect(post).toBeDefined();
		expect(post?.slug).toBe("welcome");
	});

	it("getPost returns undefined for unknown slug", () => {
		const post = getPost("nonexistent");
		expect(post).toBeUndefined();
	});

	it("getPostBody returns the matching locale component", () => {
		const post = posts[0];
		if (!post) throw new Error("expected posts[0] to exist");
		expect(getPostBody(post, "de")).toBe(post.bodies.de);
	});

	it("getPostBody falls back to en for unknown locale", () => {
		const post = posts[0];
		if (!post) throw new Error("expected posts[0] to exist");
		expect(getPostBody(post, "fr")).toBe(post.bodies.en);
	});

	it("getPostBody ignores prototype keys like __proto__ and constructor", () => {
		const post = posts[0];
		if (!post) throw new Error("expected posts[0] to exist");
		expect(getPostBody(post, "__proto__")).toBe(post.bodies.en);
		expect(getPostBody(post, "constructor")).toBe(post.bodies.en);
	});

	it("getPostBody falls back to the first body when en is missing", () => {
		const post = posts[0];
		if (!post) throw new Error("expected posts[0] to exist");
		const deBody = post.bodies.de;
		if (!deBody) throw new Error("expected posts[0].bodies.de to exist");
		const entry = { ...post, bodies: { de: deBody } };
		expect(getPostBody(entry, "fr")).toBe(deBody);
	});

	it("getPostBody throws for an entry without bodies", () => {
		const post = posts[0];
		if (!post) throw new Error("expected posts[0] to exist");
		const entry = { ...post, bodies: {} };
		expect(() => getPostBody(entry, "en")).toThrow();
	});
});

describe("Content collections - changelog", () => {
	it("exports changelog array", () => {
		expect(Array.isArray(changelog)).toBe(true);
	});

	it("changelog array has at least one entry", () => {
		expect(changelog.length).toBeGreaterThan(0);
	});

	it("each changelog entry has required fields", () => {
		for (const entry of changelog) {
			expect(entry).toHaveProperty("slug");
			expect(entry).toHaveProperty("frontmatter");
			expect(entry).toHaveProperty("bodies");
			expect(typeof entry.slug).toBe("string");
			expect(typeof entry.frontmatter).toBe("object");
			expect(typeof entry.bodies).toBe("object");
		}
	});

	it("changelog frontmatter has required fields", () => {
		for (const entry of changelog) {
			const fm = entry.frontmatter;
			expect(fm).toHaveProperty("title");
			expect(fm).toHaveProperty("publishedAt");
			expect(typeof fm.title).toBe("string");
			expect(typeof fm.publishedAt).toBe("string");
		}
	});

	it("changelog entries are sorted by publishedAt descending", () => {
		const dates = changelog.map((c) =>
			new Date(c.frontmatter.publishedAt).getTime(),
		);
		for (let i = 1; i < dates.length; i++) {
			expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i] ?? 0);
		}
	});

	it("getChangelogEntry returns correct entry by slug", () => {
		const entry = getChangelogEntry("v0-1-0");
		expect(entry).toBeDefined();
		expect(entry?.slug).toBe("v0-1-0");
	});

	it("getChangelogEntry returns undefined for unknown slug", () => {
		const entry = getChangelogEntry("nonexistent");
		expect(entry).toBeUndefined();
	});

	it("getChangelogBody returns the matching locale component", () => {
		const entry = changelog[0];
		if (!entry) throw new Error("expected changelog[0] to exist");
		expect(getChangelogBody(entry, "de")).toBe(entry.bodies.de);
	});

	it("getChangelogBody falls back to en for unknown locale", () => {
		const entry = changelog[0];
		if (!entry) throw new Error("expected changelog[0] to exist");
		expect(getChangelogBody(entry, "fr")).toBe(entry.bodies.en);
	});

	it("getChangelogBody ignores prototype keys", () => {
		const entry = changelog[0];
		if (!entry) throw new Error("expected changelog[0] to exist");
		expect(getChangelogBody(entry, "__proto__")).toBe(entry.bodies.en);
	});
});

describe("Content collections - legal documents", () => {
	it("exports legal array", () => {
		expect(Array.isArray(legal)).toBe(true);
	});

	it("legal array has expected number of documents (3 types x 2 locales)", () => {
		expect(legal.length).toBe(6);
	});

	it("each legal document has required fields", () => {
		for (const doc of legal) {
			expect(doc).toHaveProperty("slug");
			expect(doc).toHaveProperty("locale");
			expect(doc).toHaveProperty("frontmatter");
			expect(doc).toHaveProperty("body");
			expect(typeof doc.slug).toBe("string");
			expect(typeof doc.locale).toBe("string");
			expect(typeof doc.frontmatter).toBe("object");
			expect(typeof doc.body).toBe("function");
		}
	});

	it("legal frontmatter has required fields", () => {
		for (const doc of legal) {
			const fm = doc.frontmatter;
			expect(fm).toHaveProperty("title");
			expect(fm).toHaveProperty("updatedAt");
			expect(typeof fm.title).toBe("string");
			expect(typeof fm.updatedAt).toBe("string");
		}
	});

	it("legal documents have valid locales (en or de)", () => {
		const validLocales = ["en", "de"];
		for (const doc of legal) {
			expect(validLocales).toContain(doc.locale);
		}
	});

	it("getLegalDocument returns correct document by slug and locale", () => {
		const doc = getLegalDocument("privacy", "en");
		expect(doc).toBeDefined();
		expect(doc?.slug).toBe("privacy");
		expect(doc?.locale).toBe("en");
	});

	it("getLegalDocument falls back to en for unknown locale", () => {
		const doc = getLegalDocument("privacy", "fr");
		expect(doc).toBeDefined();
		expect(doc?.locale).toBe("en");
	});

	it("getLegalDocument defaults to the en locale", () => {
		const doc = getLegalDocument("privacy");
		expect(doc).toBeDefined();
		expect(doc?.locale).toBe("en");
	});

	it("getLegalDocument returns undefined for unknown slug", () => {
		const doc = getLegalDocument("nonexistent", "en");
		expect(doc).toBeUndefined();
	});

	it("getLegalDocument ignores prototype keys", () => {
		const doc = getLegalDocument("privacy", "__proto__");
		expect(doc).toBeDefined();
		expect(doc?.locale).toBe("en");
		expect(getLegalDocument("__proto__")).toBeUndefined();
	});

	it("getLegalDocument returns all expected slugs", () => {
		const slugs = ["privacy", "terms", "imprint"];
		for (const slug of slugs) {
			const doc = getLegalDocument(slug, "en");
			expect(doc).toBeDefined();
			expect(doc?.slug).toBe(slug);
			expect(getLegalDocument(slug, "de")?.locale).toBe("de");
		}
	});
});

describe("Frontmatter schemas", () => {
	it("postFrontmatterSchema accepts valid frontmatter", () => {
		expect(() =>
			postFrontmatterSchema.parse({
				title: "Test",
				publishedAt: "2024-01-01",
			}),
		).not.toThrow();
	});

	it("postFrontmatterSchema rejects an invalid publishedAt (NaN sort guard)", () => {
		expect(() =>
			postFrontmatterSchema.parse({
				title: "Test",
				publishedAt: "not-a-date",
			}),
		).toThrow();
	});

	it("changelogFrontmatterSchema rejects an invalid publishedAt", () => {
		expect(() =>
			changelogFrontmatterSchema.parse({
				title: "Test",
				publishedAt: "yesterday-ish",
			}),
		).toThrow();
	});

	it("legalDocumentFrontmatterSchema rejects an invalid updatedAt", () => {
		expect(() =>
			legalDocumentFrontmatterSchema.parse({
				title: "Test",
				updatedAt: "soon",
			}),
		).toThrow();
	});

	it("all loaded frontmatter dates parse to real dates", () => {
		for (const post of posts) {
			expect(
				Number.isNaN(new Date(post.frontmatter.publishedAt).getTime()),
			).toBe(false);
		}
		for (const entry of changelog) {
			expect(
				Number.isNaN(new Date(entry.frontmatter.publishedAt).getTime()),
			).toBe(false);
		}
		for (const doc of legal) {
			expect(Number.isNaN(new Date(doc.frontmatter.updatedAt).getTime())).toBe(
				false,
			);
		}
	});
});
