import type { PostEntry } from "./index";
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
