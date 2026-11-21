import { z } from "zod";
import { appChangelog } from "./app-changelog";
import { isoDate } from "./iso-date";

/**
 * Changelog metadata without the React bodies — `@fuutu/content/changelog-meta`.
 * For servers, MCP tools and feeds that need version/title/date/description
 * but must not import TSX. The single source of changelog frontmatter: the
 * TSX collection (`changelog` in `./index.tsx`) is built from this list.
 *
 * The entries are app-owned: `./app-changelog.ts` lists them (frontmatter)
 * and `./app-changelog-bodies.tsx` holds their bodies.
 *
 * `draft: true` marks an unreleased entry: it is validated and listed in
 * `changelogDraftMeta`, but stays out of `changelogMeta` and the
 * `changelog` collection — so off the changelog page, feeds and MCP
 * changelog / version checks. Drop the flag when the version is tagged.
 */

export interface ChangelogFrontmatter {
	title: string;
	publishedAt: string; // ISO date
	version?: string;
	description?: string;
	/** Unreleased: hidden from `changelogMeta` and the changelog page. */
	draft?: boolean;
}

export interface ChangelogMeta {
	slug: string;
	frontmatter: ChangelogFrontmatter;
}

export const changelogFrontmatterSchema = z.object({
	title: z.string().min(1),
	publishedAt: isoDate,
	version: z.string().optional(),
	description: z.string().optional(),
	draft: z.boolean().optional(),
});

/** Every entry, drafts included — newest first; frontmatter Zod-validated at load. */
const allChangelogMeta: readonly ChangelogMeta[] = Object.freeze(
	[...appChangelog]
		.map(({ slug, frontmatter }) => ({
			slug,
			frontmatter: changelogFrontmatterSchema.parse(frontmatter),
		}))
		.sort(
			(a, b) =>
				new Date(b.frontmatter.publishedAt).getTime() -
				new Date(a.frontmatter.publishedAt).getTime(),
		),
);

/** Released entries, newest first. */
export const changelogMeta: readonly ChangelogMeta[] = Object.freeze(
	allChangelogMeta.filter((entry) => !entry.frontmatter.draft),
);

/** Unreleased entries (`draft: true`), newest first. */
export const changelogDraftMeta: readonly ChangelogMeta[] = Object.freeze(
	allChangelogMeta.filter((entry) => entry.frontmatter.draft === true),
);
