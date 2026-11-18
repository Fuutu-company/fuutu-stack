import { frontmatter as example } from "./changelog/example.meta";
import type { ChangelogMeta } from "./changelog-meta";

/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Your changelog entries (frontmatter only, no TSX — feeds, MCP tools and
 * servers read this list through `@fuutu/content/changelog-meta`). Order
 * does not matter: entries are validated and sorted newest first. Give
 * every entry its bodies in `./app-changelog-bodies.tsx`.
 *
 * Add a release: `changelog/<slug>.meta.ts` + `changelog/<slug>.tsx` (+
 * `<slug>.<locale>.tsx`), then list it here and in the bodies file.
 * `draft: true` keeps an unreleased entry off the page, feeds and MCP.
 *
 * The kit ships one example entry; replace it with your own releases.
 */
export const appChangelog: readonly ChangelogMeta[] = [
	{ slug: "example", frontmatter: example },
];
