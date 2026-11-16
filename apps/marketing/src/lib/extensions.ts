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

/**
 * Metadata fields an app may set for a kit page. Kit pages set no
 * `robots`, so the app value is the page's whole robots meta (e.g.
 * `{ index: false, follow: true }`).
 */
export type AppPageMetadataFields = Pick<
	Metadata,
	"title" | "description" | "alternates" | "openGraph" | "twitter" | "robots"
>;

/**
 * Metadata for a kit page, merged over the kit's `generateMetadata` result:
 * app fields win, `undefined` keeps the kit value, `alternates`,
 * `openGraph` and `twitter` merge one level deep. A page-level `openGraph`
 * / `twitter` replaces the layout's (Next merges metadata per top-level
 * key) — repeat `images` if you set it. A function gets the request locale
 * (translate with `getTranslations({ locale, namespace })`) and, per page,
 * more context (legal and blog post pages: `slug`).
 */
export type AppPageMetadata<
	Context extends { locale: string } = { locale: string },
> =
	| AppPageMetadataFields
	| ((
			context: Context,
	  ) => AppPageMetadataFields | Promise<AppPageMetadataFields>);

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

/**
 * `/robots.txt` over the kit's (`*` may crawl `/`, sitemap
 * `<site>/sitemap.xml`). An object replaces each field it sets: `rules`
 * as a whole (one group or a list of `{ userAgent, allow, disallow,
 * crawlDelay }` groups), `sitemap` (one URL or a list), `host`. A
 * function gets the kit result and returns the final one.
 */
export type AppRobots =
	| Partial<MetadataRoute.Robots>
	| ((kit: MetadataRoute.Robots) => MetadataRoute.Robots);

/**
 * A section link on the 404 page (`appMarketing.notFoundLinks`): `href`
 * an in-app path (locale-prefixed automatically) or an absolute URL with
 * `external: true`; `labelKey` a full marketing translation key (like
 * footer links, e.g. `nav.blog`).
 */
export interface AppNotFoundLink {
	href: string;
	labelKey: string;
	external?: boolean;
}

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
	/**
	 * Page metadata over the kit's: `home` = `/`, `pricing` = `/pricing`,
	 * `blog` = `/blog`, `changelog` = `/changelog`, `contact` = `/contact`,
	 * `legal` = every `/legal/<slug>` page, `blogPost` = every
	 * `/blog/<slug>` post (the function forms get `slug`).
	 */
	metadata?: {
		home?: AppPageMetadata;
		pricing?: AppPageMetadata;
		blog?: AppPageMetadata;
		changelog?: AppPageMetadata;
		contact?: AppPageMetadata;
		legal?: AppPageMetadata<{ locale: string; slug: string }>;
		blogPost?: AppPageMetadata<{ locale: string; slug: string }>;
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
	 * Entries to leave out of `/sitemap.xml` — called for every path and
	 * locale (kit pages, legal pages, blog posts, `sitemapRoutes`) with the
	 * kit defaults, before `sitemap`; `true` drops the entry and its
	 * hreflang alternate on the entries kept.
	 */
	sitemapExclude?: (route: SitemapRoute) => boolean;
	/**
	 * App pages for `/sitemap.xml` (a list, or a function returning one),
	 * appended after the kit routes. Each is listed for every routable
	 * locale with hreflang alternates — like kit pages — and then passes
	 * through `sitemap`. A path the kit already lists throws.
	 */
	sitemapRoutes?:
		| readonly AppSitemapRoute[]
		| (() => readonly AppSitemapRoute[]);
	/** `/robots.txt` rules, sitemap and host — see `AppRobots`. */
	robots?: AppRobots;
	/**
	 * Section links under the home button on the 404 pages, in list order.
	 * Unset or empty: only the kit's home button.
	 */
	notFoundLinks?: readonly AppNotFoundLink[];
}
