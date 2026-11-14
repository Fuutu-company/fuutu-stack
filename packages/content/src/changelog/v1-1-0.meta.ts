import type { ChangelogFrontmatter } from "../changelog-meta";

/** Unreleased — `draft` keeps it off the changelog page and out of `changelogMeta`. */
export const frontmatter: ChangelogFrontmatter = {
	title: "Fuutu Stack 1.1",
	publishedAt: "2026-11-14",
	version: "1.1.0",
	description:
		"App extension points for marketing, docs, seed data and E2E, a plan-catalog-agnostic kit, and metered AI chat over an event stream.",
	draft: true,
};
