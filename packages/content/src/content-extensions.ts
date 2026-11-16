import type { LegalDocument, PostEntry } from "./index";
import { legalDocumentFrontmatterSchema } from "./legal-frontmatter";
import { postFrontmatterSchema } from "./post-frontmatter";

/** What an app changes about the kit's content collections (`./app-content.ts`). */
export interface AppContent {
	/**
	 * Kit posts to leave out everywhere (listing, post pages, static
	 * params, sitemap): slugs, or a predicate. A hidden slug is free for
	 * an `extraPosts` entry.
	 */
	hidePosts?: readonly string[] | ((post: PostEntry) => boolean);
	/**
	 * Your own posts, same shape as the kit's (`.tsx` bodies per locale).
	 * Frontmatter is validated; a slug that is already taken throws.
	 */
	extraPosts?: readonly PostEntry[];
	/**
	 * Your legal documents (`{ slug, locale, frontmatter, body }`, like
	 * `legal/privacy.en.tsx`). An entry replaces the kit document with the
	 * same slug and locale; a new slug publishes a new `/legal/<slug>`
	 * page. Frontmatter is validated; slugs are lowercase URL segments;
	 * two entries for one slug and locale throw.
	 */
	legal?: readonly LegalDocument[];
}

/** Legal documents per slug, then locale. */
export type LegalRegistry = Record<string, Record<string, LegalDocument>>;

const LEGAL_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Kit legal documents + `appContent.legal` → the published registry. */
export function applyAppLegal(
	kit: LegalRegistry,
	appLegal: readonly LegalDocument[] | undefined,
): LegalRegistry {
	const result: LegalRegistry = {};
	for (const [slug, byLocale] of Object.entries(kit)) {
		result[slug] = { ...byLocale };
	}
	const seen = new Set<string>();
	for (const entry of appLegal ?? []) {
		if (!LEGAL_SLUG.test(entry.slug)) {
			throw new Error(
				`appContent.legal: slug "${entry.slug}" must be lowercase letters, digits and dashes`,
			);
		}
		if (!entry.locale) {
			throw new Error(`appContent.legal: "${entry.slug}" has no locale`);
		}
		const key = `${entry.slug}:${entry.locale}`;
		if (seen.has(key)) {
			throw new Error(
				`appContent.legal: "${entry.slug}" (${entry.locale}) is listed twice`,
			);
		}
		seen.add(key);
		const bySlug = Object.hasOwn(result, entry.slug)
			? result[entry.slug]
			: undefined;
		result[entry.slug] = {
			...bySlug,
			[entry.locale]: {
				...entry,
				frontmatter: legalDocumentFrontmatterSchema.parse(entry.frontmatter),
			},
		};
	}
	return result;
}

/** Kit posts + app content → the published collection, newest first. */
export function applyAppContent(
	kitPosts: readonly PostEntry[],
	appContent: AppContent,
): readonly PostEntry[] {
	const { hidePosts } = appContent;
	const hidden =
		typeof hidePosts === "function"
			? hidePosts
			: (post: PostEntry) => hidePosts?.includes(post.slug) ?? false;

	const result = kitPosts.filter((post) => !hidden(post));
	const taken = new Set(result.map((post) => post.slug));
	for (const extra of appContent.extraPosts ?? []) {
		const post = {
			...extra,
			frontmatter: postFrontmatterSchema.parse(extra.frontmatter),
		};
		if (taken.has(post.slug)) {
			throw new Error(`appContent.extraPosts: slug "${post.slug}" is taken`);
		}
		taken.add(post.slug);
		result.push(post);
	}
	return Object.freeze(
		result.sort(
			(a, b) =>
				new Date(b.frontmatter.publishedAt).getTime() -
				new Date(a.frontmatter.publishedAt).getTime(),
		),
	);
}
