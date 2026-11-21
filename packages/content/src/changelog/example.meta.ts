import type { ChangelogFrontmatter } from "../changelog-meta";

/**
 * Example entry — replace it with your product's first release. One entry
 * per release: `<slug>.meta.ts` (this frontmatter), `<slug>.tsx` (English
 * body) and `<slug>.<locale>.tsx` per further locale, registered in
 * `../app-changelog.ts` and `../app-changelog-bodies.tsx`.
 */
export const frontmatter: ChangelogFrontmatter = {
	title: "First release",
	publishedAt: "2026-01-15",
	version: "0.1.0",
	description:
		"An example entry that shows how release notes look on this page.",
};
