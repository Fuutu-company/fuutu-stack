import type { Metadata, MetadataRoute } from "next";
import type { ComponentType, ReactNode } from "react";

/**
 * Marketing-app extension contract — fill it in `src/app-marketing.tsx`
 * (navbar / footer links: `src/app-site-links.ts`). Every field is
 * optional; unset fields leave the kit marketing site unchanged.
 */

/** Kit home-page sections, top to bottom. */
export type HomeSectionKey =
	| "hero"
	| "integrations"
	| "features"
	| "product-tour"
	| "security"
	| "pricing"
	| "faq"
	| "cta";

/** One home-page section; rendered without props, in list order. */
export interface HomeSection<Key extends string = string> {
	key: Key;
	Component: ComponentType;
}

/**
 * Changes to the kit home sections, applied in this order:
 * `insert` → `replace` → `remove` (an insert anchored on a removed kit
 * section still lands at its position).
 */
export interface AppHomeSections {
	/**
	 * Extra sections: `after` a kit key (or an app key inserted before),
	 * appended when omitted or not found. A key that already exists throws.
	 */
	insert?: readonly (HomeSection & {
		after?: HomeSectionKey | (string & Record<never, never>);
	})[];
	/** Swap a kit section's component; it keeps its position. */
	replace?: Partial<Record<HomeSectionKey, ComponentType>>;
	/** Kit sections to drop. */
	remove?: readonly HomeSectionKey[];
}

/** Metadata fields an app may set for a kit page. */
export type AppPageMetadataFields = Pick<
	Metadata,
	"title" | "description" | "alternates" | "openGraph"
>;

/**
 * Metadata for a kit page, merged over the kit's `generateMetadata` result:
 * app fields win, `undefined` keeps the kit value, `alternates` and
 * `openGraph` merge one level deep. A page-level `openGraph` replaces the
 * layout's (Next merges metadata per top-level key) — repeat `images` if
 * you set it. A function gets the request locale (translate with
 * `getTranslations({ locale, namespace })`).
 */
export type AppPageMetadata =
	| AppPageMetadataFields
	| ((context: {
			locale: string;
	  }) => AppPageMetadataFields | Promise<AppPageMetadataFields>);

/** One sitemap entry before the app hook, kit defaults filled in. */
export interface SitemapRoute {
	/** Locale-free path: `""` (home), `/pricing`, `/blog/<slug>`. */
	path: string;
	locale: string;
	/** `page` = static kit route, `legal` = `/legal/<slug>`, `blog` = a post. */
	kind: "page" | "legal" | "blog";
	lastModified: string | Date;
	changeFrequency: NonNullable<
		MetadataRoute.Sitemap[number]["changeFrequency"]
	>;
	priority: number;
}

/**
 * An app page for the sitemap (`appMarketing.sitemapRoutes`). Unset
 * values take the kit defaults for static pages: `lastModified` = build
 * time, `changeFrequency: "weekly"`, `priority: 0.7`.
 */
export interface AppSitemapRoute {
	/** Locale-free path, e.g. `/support` — prefixed per locale by the kit. */
	path: string;
	kind?: "page";
	lastModified?: string | Date;
	changeFrequency?: SitemapRoute["changeFrequency"];
	priority?: number;
}

/** Values the app sets for one sitemap entry; unset fields keep the kit's. */
export type SitemapRouteOverride = Partial<
	Pick<SitemapRoute, "lastModified" | "changeFrequency" | "priority">
>;

export interface AppMarketing {
	/** Home page (`/`) composition. */
	homeSections?: AppHomeSections;
	/**
	 * Replace the kit pricing cards wherever `@marketing/pricing` is used:
	 * `Home` = home-page pricing section, `Page` = `/pricing` page.
	 */
	PricingCards?: {
		Home?: ComponentType;
		Page?: ComponentType;
	};
	/** Page metadata over the kit's: `home` = `/`, `pricing` = `/pricing`. */
	metadata?: {
		home?: AppPageMetadata;
		pricing?: AppPageMetadata;
	};
	/**
	 * `/pricing` header: `{ title?, description? }` swaps the texts in the
	 * kit intro (a node, e.g. a translated server component); a component
	 * replaces the whole header block.
	 */
	pricingHeader?:
		| ComponentType
		| {
				title?: ReactNode;
				description?: ReactNode;
		  };
	/**
	 * Rendered once in the marketing layout body, after the page chrome
	 * (site-wide JSON-LD, chat widgets). Inside the intl + theme providers.
	 */
	LayoutSlot?: ComponentType<{ locale: string }>;
	/**
	 * Per-entry sitemap values (`/sitemap.xml`) — called for every path and
	 * locale with the kit defaults; return overrides (e.g. a real
	 * `lastModified`) or `undefined` to keep them.
	 */
	sitemap?: (route: SitemapRoute) => SitemapRouteOverride | undefined;
	/**
	 * App pages for `/sitemap.xml` (a list, or a function returning one),
	 * appended after the kit routes. Each is listed for every routable
	 * locale with hreflang alternates — like kit pages — and then passes
	 * through `sitemap`. A path the kit already lists throws.
	 */
	sitemapRoutes?:
		| readonly AppSitemapRoute[]
		| (() => readonly AppSitemapRoute[]);
}
