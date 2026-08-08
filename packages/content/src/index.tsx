import type { ComponentType } from "react";

import ChangelogV010, {
	frontmatter as changelogV010Frontmatter,
} from "./changelog/v0-1-0";
import ChangelogV010De from "./changelog/v0-1-0.de";
import ImprintDe, {
	frontmatter as imprintDeFrontmatter,
} from "./legal/imprint.de";
import ImprintEn, {
	frontmatter as imprintEnFrontmatter,
} from "./legal/imprint.en";
import PrivacyDe, {
	frontmatter as privacyDeFrontmatter,
} from "./legal/privacy.de";
import PrivacyEn, {
	frontmatter as privacyEnFrontmatter,
} from "./legal/privacy.en";
import TermsDe, { frontmatter as termsDeFrontmatter } from "./legal/terms.de";
import TermsEn, { frontmatter as termsEnFrontmatter } from "./legal/terms.en";
import WelcomePost, {
	frontmatter as welcomeFrontmatter,
} from "./posts/welcome";
import WelcomePostDe from "./posts/welcome.de";

/**
 * Typed content collections for the marketing site.
 *
 * Posts and changelog entries are authored as `.tsx` modules with a typed
 * `frontmatter` export plus a default-exported body component per locale —
 * the same pattern used by `./legal/*.{en,de}.tsx`. This keeps the package
 * zero-dep and Edge-friendly.
 */

export interface PostFrontmatter {
	title: string;
	description?: string;
	publishedAt: string; // ISO date
	draft?: boolean;
	authors?: string[];
	tags?: string[];
}

export interface ChangelogFrontmatter {
	title: string;
	publishedAt: string; // ISO date
	version?: string;
	description?: string;
}

export interface PostEntry {
	slug: string;
	frontmatter: PostFrontmatter;
	/** Locale → body component. Fallback chain: requested → "en" → first. */
	bodies: Record<string, ComponentType>;
}

export interface ChangelogEntry {
	slug: string;
	frontmatter: ChangelogFrontmatter;
	bodies: Record<string, ComponentType>;
}

export interface LegalDocumentFrontmatter {
	title: string;
	updatedAt: string;
}

export interface LegalDocument {
	slug: string;
	locale: string;
	frontmatter: LegalDocumentFrontmatter;
	body: ComponentType;
}

function resolveBody(
	bodies: Record<string, ComponentType>,
	locale: string,
): ComponentType {
	return (
		bodies[locale] ?? bodies.en ?? (Object.values(bodies)[0] as ComponentType)
	);
}

export const posts: PostEntry[] = [
	{
		slug: "welcome",
		frontmatter: welcomeFrontmatter,
		bodies: { en: WelcomePost, de: WelcomePostDe },
	},
].sort(
	(a, b) =>
		new Date(b.frontmatter.publishedAt).getTime() -
		new Date(a.frontmatter.publishedAt).getTime(),
);

export const changelog: ChangelogEntry[] = [
	{
		slug: "v0-1-0",
		frontmatter: changelogV010Frontmatter,
		bodies: { en: ChangelogV010, de: ChangelogV010De },
	},
].sort(
	(a, b) =>
		new Date(b.frontmatter.publishedAt).getTime() -
		new Date(a.frontmatter.publishedAt).getTime(),
);

const LEGAL_REGISTRY: Record<string, Record<string, LegalDocument>> = {
	privacy: {
		en: {
			slug: "privacy",
			locale: "en",
			frontmatter: privacyEnFrontmatter,
			body: PrivacyEn,
		},
		de: {
			slug: "privacy",
			locale: "de",
			frontmatter: privacyDeFrontmatter,
			body: PrivacyDe,
		},
	},
	terms: {
		en: {
			slug: "terms",
			locale: "en",
			frontmatter: termsEnFrontmatter,
			body: TermsEn,
		},
		de: {
			slug: "terms",
			locale: "de",
			frontmatter: termsDeFrontmatter,
			body: TermsDe,
		},
	},
	imprint: {
		en: {
			slug: "imprint",
			locale: "en",
			frontmatter: imprintEnFrontmatter,
			body: ImprintEn,
		},
		de: {
			slug: "imprint",
			locale: "de",
			frontmatter: imprintDeFrontmatter,
			body: ImprintDe,
		},
	},
};

export const legal: LegalDocument[] = Object.values(LEGAL_REGISTRY).flatMap(
	(byLocale) => Object.values(byLocale),
);

export function getLegalDocument(
	slug: string,
	locale = "en",
): LegalDocument | null {
	const bySlug = LEGAL_REGISTRY[slug];
	if (!bySlug) return null;
	return bySlug[locale] ?? bySlug.en ?? null;
}

export function getPost(slug: string): PostEntry | undefined {
	return posts.find((p) => p.slug === slug);
}

export function getChangelogEntry(slug: string): ChangelogEntry | undefined {
	return changelog.find((c) => c.slug === slug);
}

/** Resolve a post body component for the given locale (with fallback). */
export function getPostBody(entry: PostEntry, locale: string): ComponentType {
	return resolveBody(entry.bodies, locale);
}

/** Resolve a changelog body component for the given locale (with fallback). */
export function getChangelogBody(
	entry: ChangelogEntry,
	locale: string,
): ComponentType {
	return resolveBody(entry.bodies, locale);
}
