import type { ComponentType } from "react";
import { appChangelogBodies } from "./app-changelog-bodies";
import { appContent } from "./app-content";
import {
	type ChangelogFrontmatter,
	changelogDraftMeta,
	changelogMeta,
} from "./changelog-meta";
import { applyAppContent, applyAppLegal } from "./content-extensions";
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
import { legalDocumentFrontmatterSchema } from "./legal-frontmatter";
import { postFrontmatterSchema } from "./post-frontmatter";
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
 * Edge-friendly.
 *
 * File-naming convention: the canonical English body carries no locale
 * suffix (`posts/welcome.tsx`), additional locales are suffixed
 * (`posts/welcome.de.tsx`). Legal documents are fully locale-paired with
 * no canonical fallback (`legal/privacy.en.tsx`, `legal/privacy.de.tsx`).
 *
 * Frontmatter is Zod-validated at collection load — an invalid
 * `publishedAt`/`updatedAt` fails fast instead of producing NaN sorts.
 */

export interface PostFrontmatter {
	title: string;
	description?: string;
	publishedAt: string; // ISO date
	draft?: boolean;
	authors?: string[];
	tags?: string[];
}

export {
	type ChangelogFrontmatter,
	type ChangelogMeta,
	changelogDraftMeta,
	changelogFrontmatterSchema,
	changelogMeta,
} from "./changelog-meta";

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

export { legalDocumentFrontmatterSchema } from "./legal-frontmatter";
export { postFrontmatterSchema } from "./post-frontmatter";

function resolveBody(
	bodies: Record<string, ComponentType>,
	locale: string,
): ComponentType {
	const resolved =
		(Object.hasOwn(bodies, locale) ? bodies[locale] : undefined) ??
		bodies.en ??
		Object.values(bodies)[0];
	if (!resolved) throw new Error("Content entry has no body components");
	return resolved;
}

const kitPosts: PostEntry[] = [
	{
		slug: "welcome",
		frontmatter: postFrontmatterSchema.parse(welcomeFrontmatter),
		bodies: { en: WelcomePost, de: WelcomePostDe },
	},
];

/**
 * Blog posts, newest first: the kit's demo posts with `appContent`
 * applied (`./app-content.ts` — hide kit posts, add your own). Listing,
 * post pages, static params and the sitemap all read this collection.
 */
export const posts: readonly PostEntry[] = applyAppContent(
	kitPosts,
	appContent,
);

/** Changelog bodies per slug — app-owned in `./app-changelog-bodies.tsx`. */
const CHANGELOG_BODIES = appChangelogBodies;

for (const { slug } of changelogDraftMeta) {
	if (!Object.hasOwn(CHANGELOG_BODIES, slug)) {
		throw new Error(`Changelog draft "${slug}" has no bodies`);
	}
}

/**
 * Released entries, newest first — order and frontmatter come from
 * `changelogMeta`; drafts (`changelogDraftMeta`) are left out.
 */
export const changelog: readonly ChangelogEntry[] = Object.freeze(
	changelogMeta.map(({ slug, frontmatter }) => {
		const bodies = Object.hasOwn(CHANGELOG_BODIES, slug)
			? CHANGELOG_BODIES[slug]
			: undefined;
		if (!bodies) throw new Error(`Changelog entry "${slug}" has no bodies`);
		return { slug, frontmatter, bodies };
	}),
);

const KIT_LEGAL_REGISTRY: Record<string, Record<string, LegalDocument>> = {
	privacy: {
		en: {
			slug: "privacy",
			locale: "en",
			frontmatter: legalDocumentFrontmatterSchema.parse(privacyEnFrontmatter),
			body: PrivacyEn,
		},
		de: {
			slug: "privacy",
			locale: "de",
			frontmatter: legalDocumentFrontmatterSchema.parse(privacyDeFrontmatter),
			body: PrivacyDe,
		},
	},
	terms: {
		en: {
			slug: "terms",
			locale: "en",
			frontmatter: legalDocumentFrontmatterSchema.parse(termsEnFrontmatter),
			body: TermsEn,
		},
		de: {
			slug: "terms",
			locale: "de",
			frontmatter: legalDocumentFrontmatterSchema.parse(termsDeFrontmatter),
			body: TermsDe,
		},
	},
	imprint: {
		en: {
			slug: "imprint",
			locale: "en",
			frontmatter: legalDocumentFrontmatterSchema.parse(imprintEnFrontmatter),
			body: ImprintEn,
		},
		de: {
			slug: "imprint",
			locale: "de",
			frontmatter: legalDocumentFrontmatterSchema.parse(imprintDeFrontmatter),
			body: ImprintDe,
		},
	},
};

/**
 * Legal documents per slug and locale: the kit's with `appContent.legal`
 * applied (`./app-content.ts` — replace a kit document, add a page). The
 * legal pages, their static params and the sitemap read it.
 */
const LEGAL_REGISTRY = applyAppLegal(KIT_LEGAL_REGISTRY, appContent.legal);

export const legal: readonly LegalDocument[] = Object.freeze(
	Object.values(LEGAL_REGISTRY).flatMap((byLocale) => Object.values(byLocale)),
);

export function getLegalDocument(
	slug: string,
	locale = "en",
): LegalDocument | undefined {
	const bySlug = Object.hasOwn(LEGAL_REGISTRY, slug)
		? LEGAL_REGISTRY[slug]
		: undefined;
	if (!bySlug) return undefined;
	return (
		(Object.hasOwn(bySlug, locale) ? bySlug[locale] : undefined) ?? bySlug.en
	);
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
