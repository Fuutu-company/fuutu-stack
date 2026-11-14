import { posts } from "@fuutu/content";

/**
 * Slug of the newest published blog post — `@fuutu/content` with
 * `appContent` applied (hidden kit posts left out, app posts added), so a
 * spec hits a post the app actually serves. `undefined`: the blog is empty.
 */
export const FIRST_POST_SLUG: string | undefined = posts.find(
	(post) => !post.frontmatter.draft,
)?.slug;

/** `test.skip` reason when the app publishes no post. */
export const NO_PUBLISHED_POST =
	"no published blog post (@fuutu/content posts after appContent)";
