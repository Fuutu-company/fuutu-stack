import { i18nConfig } from "@fuutu/i18n/config";
import type { Metadata } from "next";
import type { AppPageMetadata } from "./extensions";
import { languageAlternates, localeUrl } from "./locale-url";

/** The object without its `undefined` fields — so a spread keeps the base value. */
export function definedFields<T extends object>(value: T): Partial<T> {
	return Object.fromEntries(
		Object.entries(value).filter(([, v]) => v !== undefined),
	) as Partial<T>;
}

const OG_IMAGE = { url: "/og-image.png", width: 1200, height: 630 };

/**
 * The kit's SEO metadata for a page: `title`, `description`, a canonical URL,
 * hreflang `alternates.languages` (only while i18n is enabled; one entry per
 * routable locale plus `x-default`) and an `openGraph` block with the
 * page URL, title, description, locale and the default share image
 * (a page's `openGraph` replaces the root layout's, so the image is
 * repeated here). A route with its own `opengraph-image` file passes
 * `ogImage: false` — an exported image would hide the file's. `path` is the page path without locale prefix (`""` =
 * home, `"/pricing"`, `"/blog/my-post"`). URLs are relative —
 * `metadataBase` (`marketingBaseUrl()`) makes them absolute. The root
 * layout appends ` | <app name>` to `title`; `{ absolute }` skips that.
 *
 * Kit pages pass the result to `withAppMetadata`, so `appMarketing.metadata`
 * still wins; app pages call it the same way to get canonical + hreflang
 * without rebuilding them.
 */
export function pageMetadata({
	locale,
	path,
	title,
	description,
	ogImage = true,
}: {
	locale: string;
	path: string;
	title: string | { absolute: string };
	description?: string;
	/** `false`: no share image — the route's `opengraph-image` file applies. */
	ogImage?: boolean;
}): Metadata {
	const url = localeUrl("", locale, path) || "/";
	const plainTitle = typeof title === "string" ? title : title.absolute;
	return {
		title,
		...(description === undefined ? {} : { description }),
		alternates: {
			canonical: url,
			...(i18nConfig.enabled ? { languages: languageAlternates(path) } : {}),
		},
		openGraph: {
			url,
			title: plainTitle,
			...(description === undefined ? {} : { description }),
			locale,
			...(ogImage ? { images: [OG_IMAGE] } : {}),
		},
	};
}

/**
 * The kit page metadata with the app's override (`appMarketing.metadata`)
 * merged over it — see `AppPageMetadata`. `context` adds page values for
 * a function override (legal: `{ slug }`). Without an override the kit
 * object comes back unchanged.
 */
export async function withAppMetadata<
	Context extends { locale: string } = { locale: string },
>(
	kit: Metadata,
	app: AppPageMetadata<Context> | undefined,
	locale: string,
	context?: Omit<Context, "locale">,
): Promise<Metadata> {
	if (!app) return kit;
	const extra = definedFields(
		typeof app === "function"
			? await app({ ...context, locale } as Context)
			: app,
	);
	const merged: Metadata = { ...kit, ...extra };
	if (kit.alternates && extra.alternates) {
		merged.alternates = { ...kit.alternates, ...extra.alternates };
	}
	if (kit.openGraph && extra.openGraph) {
		merged.openGraph = {
			...kit.openGraph,
			...extra.openGraph,
		} as Metadata["openGraph"];
		// `images: []` drops the kit share image, so an `opengraph-image`
		// file the app adds to a kit route folder applies.
		const images = extra.openGraph.images;
		if (Array.isArray(images) && images.length === 0 && merged.openGraph) {
			const { images: _dropped, ...rest } = merged.openGraph;
			merged.openGraph = rest as Metadata["openGraph"];
		}
	}
	if (kit.twitter && extra.twitter) {
		merged.twitter = {
			...kit.twitter,
			...extra.twitter,
		} as Metadata["twitter"];
	}
	return merged;
}
