import { z } from "zod";
import { frontmatter as v010 } from "./changelog/v0-1-0.meta";
import { frontmatter as v100 } from "./changelog/v1-0-0.meta";
import { isoDate } from "./iso-date";

/**
 * Changelog metadata without the React bodies — `@fuutu/content/changelog-meta`.
 * For servers, MCP tools and feeds that need version/title/date/description
 * but must not import TSX. The single source of changelog frontmatter: the
 * TSX collection (`changelog` in `./index.tsx`) is built from this list.
 *
 * Add an entry: `changelog/<slug>.meta.ts` (frontmatter) + `<slug>.tsx`
 * (body, plus `<slug>.<locale>.tsx`), then register the meta below and
 * the bodies in `./index.tsx`.
 */

export interface ChangelogFrontmatter {
	title: string;
	publishedAt: string; // ISO date
	version?: string;
	description?: string;
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
});

/** Newest first; frontmatter Zod-validated at load. */
export const changelogMeta: readonly ChangelogMeta[] = Object.freeze(
	[
		{ slug: "v1-0-0", frontmatter: v100 },
		{ slug: "v0-1-0", frontmatter: v010 },
	]
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
