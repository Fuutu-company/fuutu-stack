import type { AppContent } from "./content-extensions";

/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Changes to the kit's content collections, applied wherever the kit
 * reads them (blog listing, post pages, static params, sitemap):
 *
 * - `hidePosts`: kit demo posts to leave out — slugs or a predicate.
 *   Hiding every post leaves an empty blog; unknown slugs still 404.
 * - `extraPosts`: your own posts (`{ slug, frontmatter, bodies }`, bodies
 *   per locale like `posts/welcome.tsx`); a taken slug throws.
 *
 * ```ts
 * import LaunchPost, { frontmatter as launch } from "./posts/launch";
 * export const appContent: AppContent = {
 *   hidePosts: ["welcome"],
 *   extraPosts: [{ slug: "launch", frontmatter: launch, bodies: { en: LaunchPost } }],
 * };
 * ```
 */
export const appContent: AppContent = {};
