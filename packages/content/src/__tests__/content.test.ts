import { describe, expect, it } from "vitest";
import {
	type ChangelogFrontmatter,
	changelog,
	getChangelogBody,
	getChangelogEntry,
	getLegalDocument,
	getPost,
	getPostBody,
	type LegalDocumentFrontmatter,
	legal,
	type PostFrontmatter,
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
			const fm = post.frontmatter as PostFrontmatter;
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

	it("getPostBody returns a component for valid locale", () => {
		const post = posts[0];
		if (!post) return;
		const body = getPostBody(post, "en");
		expect(typeof body).toBe("function");
	});

	it("getPostBody falls back to en for unknown locale", () => {
		const post = posts[0];
		if (!post) return;
		const body = getPostBody(post, "fr");
		expect(typeof body).toBe("function");
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
			const fm = entry.frontmatter as ChangelogFrontmatter;
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

	it("getChangelogBody returns a component for valid locale", () => {
		const entry = changelog[0];
		if (!entry) return;
		const body = getChangelogBody(entry, "en");
		expect(typeof body).toBe("function");
	});

	it("getChangelogBody falls back to en for unknown locale", () => {
		const entry = changelog[0];
		if (!entry) return;
		const body = getChangelogBody(entry, "fr");
		expect(typeof body).toBe("function");
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
			const fm = doc.frontmatter as LegalDocumentFrontmatter;
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

	it("getLegalDocument returns null for unknown slug", () => {
		const doc = getLegalDocument("nonexistent", "en");
		expect(doc).toBeNull();
	});

	it("getLegalDocument returns all expected slugs", () => {
		const slugs = ["privacy", "terms", "imprint"];
		for (const slug of slugs) {
			const doc = getLegalDocument(slug, "en");
			expect(doc).toBeDefined();
			expect(doc?.slug).toBe(slug);
		}
	});
});

describe("Type exports", () => {
	it("exports PostFrontmatter type", () => {
		const fm: PostFrontmatter = {
			title: "Test",
			publishedAt: "2024-01-01",
		};
		expect(fm.title).toBe("Test");
	});

	it("exports ChangelogFrontmatter type", () => {
		const fm: ChangelogFrontmatter = {
			title: "Test",
			publishedAt: "2024-01-01",
		};
		expect(fm.title).toBe("Test");
	});

	it("exports LegalDocumentFrontmatter type", () => {
		const fm: LegalDocumentFrontmatter = {
			title: "Test",
			updatedAt: "2024-01-01",
		};
		expect(fm.title).toBe("Test");
	});
});
