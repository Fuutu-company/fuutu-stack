import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppPageMetadataFields } from "../../../../apps/marketing/src/lib/extensions";

/**
 * App-owned marketing SEO and page-chrome extensions (`app-marketing.tsx`):
 * page metadata (`metadata.home` / `.pricing`), the `/pricing` header
 * (`pricingHeader`), the layout slot (`LayoutSlot`), per-route sitemap
 * values (`sitemap`) and app sitemap routes (`sitemapRoutes`). Unset
 * fields must reproduce the kit output exactly — and the sitemap never
 * lists URLs a disabled locale does not serve.
 */

const ROOT = join(import.meta.dirname, "../../../..");
const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

const app = vi.hoisted(() => ({
	appMarketing: {} as Record<string, unknown>,
	appKitRoutes: {} as Record<string, unknown>,
}));
vi.mock("../../../../apps/marketing/src/app-site-links", () => ({
	get appKitRoutes() {
		return app.appKitRoutes;
	},
}));
vi.mock("@/app-marketing", () => ({
	get appMarketing() {
		return app.appMarketing;
	},
}));

const i18n = vi.hoisted(() => ({
	i18nConfig: {
		enabled: true,
		locales: { en: {}, de: {} },
		defaultLocale: "en",
	},
}));
vi.mock("../../../../packages/i18n/config", () => i18n);
vi.mock("@/i18n/config", () => ({
	defaultLocale: "en",
	locales: ["en", "de"],
}));
vi.mock("../../../../packages/env/src/marketing", () => ({
	env: { NEXT_PUBLIC_MARKETING_URL: "https://site.test" },
}));
vi.mock("../../../../packages/content/src/index", () => ({
	legal: [
		{ slug: "privacy", locale: "en" },
		{ slug: "privacy", locale: "de" },
	],
	posts: [
		{ slug: "hello", frontmatter: { publishedAt: "2026-01-02" } },
		{ slug: "wip", frontmatter: { publishedAt: "2026-01-03", draft: true } },
	],
}));

const KitIntro = () => null;
vi.mock(
	"../../../../apps/marketing/src/modules/shared/components/page-intro",
	() => ({ PageIntro: KitIntro }),
);
vi.mock(
	"../../../../apps/marketing/src/modules/marketing/pricing/components/pricing-cards",
	() => ({ PricingCardsHome: () => null, PricingCardsPage: () => null }),
);

const { withAppMetadata, pageMetadata } = await import(
	"../../../../apps/marketing/src/lib/page-metadata"
);
const { languageAlternates, localeUrl } = await import(
	"../../../../apps/marketing/src/lib/locale-url"
);
const { marketingBaseUrl } = await import(
	"../../../../apps/marketing/src/lib/marketing-base-url"
);
const { serializeJsonLd } = await import(
	"../../../../apps/marketing/src/lib/json-ld"
);
type SitemapEntry = {
	url: string;
	lastModified?: string | Date;
	changeFrequency?: string;
	priority?: number;
	alternates?: unknown;
};
// Non-literal path: the sitemap imports `@/` aliases and `.tsx` content
// this package's tsc cannot follow; vitest resolves it like any import.
const SITEMAP = join(ROOT, "apps/marketing/src/app/sitemap.ts");
const sitemap = (
	(await import(/* @vite-ignore */ SITEMAP)) as {
		default: () => SitemapEntry[];
	}
).default;

beforeEach(() => {
	app.appMarketing = {};
	app.appKitRoutes = {};
	i18n.i18nConfig.enabled = true;
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-11-14T00:00:00.000Z"));
});
afterEach(() => {
	vi.useRealTimers();
});

describe("marketing base URL", () => {
	it("is NEXT_PUBLIC_MARKETING_URL, and the root layout uses it", () => {
		expect(marketingBaseUrl()).toBe("https://site.test");
		const layout = read("apps/marketing/src/app/layout.tsx");
		expect(layout).toMatch(/metadataBase: new URL\(marketingBaseUrl\(\)\)/);
		expect(layout).not.toMatch(/getBaseUrl/);
	});
});

describe("hreflang alternates", () => {
	it("lists every routable locale plus x-default, as relative URLs", () => {
		expect(languageAlternates("/pricing")).toEqual({
			en: "/pricing",
			de: "/de/pricing",
			"x-default": "/pricing",
		});
		expect(languageAlternates("")).toEqual({
			en: "/",
			de: "/de",
			"x-default": "/",
		});
	});

	it("names only the default locale while i18n is disabled", () => {
		i18n.i18nConfig.enabled = false;
		expect(languageAlternates("/blog")).toEqual({
			en: "/blog",
			"x-default": "/blog",
		});
	});

	it("prefixes every locale but the default", () => {
		expect(localeUrl("https://site.test", "en", "/blog")).toBe(
			"https://site.test/blog",
		);
		expect(localeUrl("https://site.test", "de", "/blog")).toBe(
			"https://site.test/de/blog",
		);
	});
});

describe("kit page SEO metadata (pageMetadata)", () => {
	const page = {
		locale: "en",
		path: "/pricing",
		title: "Pricing",
		description: "Plans",
	};

	it("sets title, description, canonical, hreflang and OpenGraph", () => {
		expect(pageMetadata(page)).toEqual({
			title: "Pricing",
			description: "Plans",
			alternates: {
				canonical: "/pricing",
				languages: {
					en: "/pricing",
					de: "/de/pricing",
					"x-default": "/pricing",
				},
			},
			openGraph: {
				url: "/pricing",
				title: "Pricing",
				description: "Plans",
				locale: "en",
				images: [{ url: "/og-image.png", width: 1200, height: 630 }],
			},
		});
	});

	it("points the canonical at the locale's own URL", () => {
		const meta = pageMetadata({ ...page, locale: "de" });
		expect(meta.alternates?.canonical).toBe("/de/pricing");
		expect(meta.openGraph).toMatchObject({ url: "/de/pricing", locale: "de" });
		expect(
			pageMetadata({ ...page, locale: "de", path: "" }).alternates,
		).toMatchObject({ canonical: "/de" });
		expect(pageMetadata({ ...page, path: "" }).alternates).toMatchObject({
			canonical: "/",
		});
	});

	it("emits no hreflang languages while i18n is disabled, but keeps the canonical", () => {
		i18n.i18nConfig.enabled = false;
		expect(pageMetadata(page).alternates).toEqual({ canonical: "/pricing" });
	});

	it("leaves the description out when there is none", () => {
		const meta = pageMetadata({ ...page, description: undefined });
		expect(meta).not.toHaveProperty("description");
		expect(meta.openGraph).not.toHaveProperty("description");
	});

	it("lets the app override win, field by field", async () => {
		const meta = await withAppMetadata(
			pageMetadata(page),
			{
				title: "Acme pricing",
				alternates: { canonical: "https://acme.test/plans" },
				openGraph: { title: "OG" },
			},
			"en",
		);
		expect(meta.title).toBe("Acme pricing");
		expect(meta.description).toBe("Plans");
		expect(meta.alternates).toEqual({
			canonical: "https://acme.test/plans",
			languages: { en: "/pricing", de: "/de/pricing", "x-default": "/pricing" },
		});
		expect(meta.openGraph).toMatchObject({
			title: "OG",
			url: "/pricing",
			locale: "en",
		});
	});

	it("every kit page builds its metadata with the right path", () => {
		const dir = "apps/marketing/src/app/(marketing)/[locale]";
		const paths: [string, RegExp][] = [
			["page.tsx", /path: "",/],
			["pricing/page.tsx", /path: "\/pricing",/],
			["blog/page.tsx", /path: "\/blog",/],
			["changelog/page.tsx", /path: "\/changelog",/],
			["contact/page.tsx", /path: "\/contact",/],
			["blog/[slug]/page.tsx", /path: `\/blog\/\$\{slug\}`,/],
			["legal/[slug]/page.tsx", /path: `\/legal\/\$\{slug\}`,/],
		];
		for (const [file, path] of paths) {
			expect(read(`${dir}/${file}`), file).toMatch(path);
		}
	});

	it("takes an absolute title and keeps the OpenGraph title plain", () => {
		const meta = pageMetadata({ ...page, title: { absolute: "Home | Acme" } });
		expect(meta.title).toEqual({ absolute: "Home | Acme" });
		expect(meta.openGraph).toMatchObject({ title: "Home | Acme" });
	});

	it("the root layout appends the app name to every page title", () => {
		expect(read("apps/marketing/src/app/layout.tsx")).toMatch(
			/title: \{ template: `%s \| \$\{config\.app\.name\}`, default: config\.app\.name \}/,
		);
	});
});

describe("JSON-LD serialization", () => {
	it("keeps the data equal when parsed", () => {
		const data = { "@type": "Question", name: "a & b <c>", n: [1, true, null] };
		expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
	});

	it("escapes the characters that could end the script tag or the line", () => {
		const out = serializeJsonLd({
			q: `</script><img src=x onerror=alert(1)> & ${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}`,
		});
		expect(out).not.toMatch(/[<>&]/);
		expect(out).not.toContain(String.fromCharCode(0x2028));
		expect(out).not.toContain(String.fromCharCode(0x2029));
		expect(out).toContain("\\u003c/script\\u003e");
		expect(out).toContain("\\u0026");
		expect(out).toContain("\\u2028\\u2029");
	});

	it("the FAQ emits its structured data through it", () => {
		const faq = read(
			"apps/marketing/src/modules/marketing/home/components/faq.tsx",
		);
		expect(faq).toMatch(/__html: serializeJsonLd\(jsonLd\)/);
		expect(faq).not.toMatch(/JSON\.stringify/);
	});
});

describe("page metadata", () => {
	const kit = { title: "Kit title", description: "Kit description" };

	it("returns the kit metadata as is without an app override", async () => {
		expect(await withAppMetadata(kit, undefined, "en")).toBe(kit);
	});

	it("merges app fields over the kit's; unset app fields keep the kit value", async () => {
		expect(
			await withAppMetadata(
				kit,
				{
					title: "App title",
					description: undefined,
					alternates: { canonical: "https://site.test/" },
					openGraph: { title: "OG" },
				},
				"en",
			),
		).toEqual({
			title: "App title",
			description: "Kit description",
			alternates: { canonical: "https://site.test/" },
			openGraph: { title: "OG" },
		});
	});

	it("resolves a per-locale override and merges nested alternates / openGraph", async () => {
		const result = await withAppMetadata(
			{
				...kit,
				alternates: { languages: { de: "/de" } },
				openGraph: { siteName: "Kit" },
			},
			async ({ locale }) => ({
				title: `App ${locale}`,
				alternates: { canonical: `/${locale}` },
				openGraph: { title: "OG" },
			}),
			"de",
		);
		expect(result).toEqual({
			title: "App de",
			description: "Kit description",
			alternates: { languages: { de: "/de" }, canonical: "/de" },
			openGraph: { siteName: "Kit", title: "OG" },
		});
	});

	it("merges twitter one level deep, like openGraph", async () => {
		expect(
			await withAppMetadata(
				{ ...kit, twitter: { card: "summary_large_image", site: "@kit" } },
				{ twitter: { title: "App card" } },
				"en",
			),
		).toEqual({
			...kit,
			twitter: { card: "summary_large_image", site: "@kit", title: "App card" },
		});
	});

	it("sets robots per page; kit pages set none, so the app value stands alone", async () => {
		const noindex = {
			robots: { index: false, follow: true },
		} satisfies AppPageMetadataFields;
		expect(await withAppMetadata(kit, noindex, "en")).toEqual({
			...kit,
			robots: { index: false, follow: true },
		});
		expect(
			await withAppMetadata(
				kit,
				({ slug }: { locale: string; slug: string }) =>
					slug === "imprint" ? { robots: "noindex" } : {},
				"en",
				{ slug: "privacy" },
			),
		).toEqual(kit);
	});

	it("passes extra page context (the legal slug) to a function override", async () => {
		const result = await withAppMetadata(
			kit,
			({ locale, slug }: { locale: string; slug: string }) => ({
				title: `${slug} (${locale})`,
			}),
			"de",
			{ slug: "privacy" },
		);
		expect(result.title).toBe("privacy (de)");
	});

	it("blog, changelog, contact and legal pages pass their kit metadata through the app override", () => {
		for (const key of ["blog", "changelog", "contact"]) {
			expect(
				read(`apps/marketing/src/app/(marketing)/[locale]/${key}/page.tsx`),
				key,
			).toMatch(
				new RegExp(
					`withAppMetadata\\(\\s*pageMetadata\\(\\{[\\s\\S]*?\\}\\),\\s*appMarketing\\.metadata\\?\\.${key},\\s*locale,?\\s*\\)`,
				),
			);
		}
		expect(
			read("apps/marketing/src/app/(marketing)/[locale]/legal/[slug]/page.tsx"),
		).toMatch(
			/withAppMetadata\(\s*pageMetadata\(\{[\s\S]*?\}\),\s*appMarketing\.metadata\?\.legal,\s*locale,\s*\{ slug \},?\s*\)/,
		);
	});

	it("blog post pages pass their kit metadata through the app override, with the slug", () => {
		expect(
			read("apps/marketing/src/app/(marketing)/[locale]/blog/[slug]/page.tsx"),
		).toMatch(
			/withAppMetadata\(\s*pageMetadata\(\{[\s\S]*?\}\),\s*appMarketing\.metadata\?\.blogPost,\s*locale,\s*\{ slug \},?\s*\)/,
		);
	});

	it("home and pricing pages pass their kit metadata through the app override", () => {
		expect(
			read("apps/marketing/src/app/(marketing)/[locale]/page.tsx"),
		).toMatch(
			/withAppMetadata\(\s*pageMetadata\(\{[\s\S]*?\}\),\s*appMarketing\.metadata\?\.home,\s*locale,?\s*\)/,
		);
		expect(
			read("apps/marketing/src/app/(marketing)/[locale]/pricing/page.tsx"),
		).toMatch(
			/withAppMetadata\(\s*pageMetadata\(\{[\s\S]*?\}\),\s*appMarketing\.metadata\?\.pricing,\s*locale,?\s*\)/,
		);
	});
});

describe("pricing page header", () => {
	// Non-literal path: the module imports `.tsx` files this package's tsc
	// (no JSX) must not follow; vitest resolves it like any import.
	const PRICING = join(
		ROOT,
		"apps/marketing/src/modules/marketing/pricing/index.ts",
	);
	type El = { type: unknown; props: Record<string, unknown> };
	const render = async () => {
		const { PricingPageHeader } = (await import(
			/* @vite-ignore */ PRICING
		)) as { PricingPageHeader: (p: object) => El };
		return PricingPageHeader({ title: "Kit T", description: "Kit D" });
	};

	it("renders the kit intro (title + description) without an override", async () => {
		const el = await render();
		expect(el.type).toBe("div");
		expect(el.props.className).toBe(
			"mx-auto max-w-6xl px-4 pt-12 sm:px-6 md:pt-20",
		);
		const intro = el.props.children as El;
		expect(intro.type).toBe(KitIntro);
		expect(intro.props).toEqual({
			align: "center",
			title: "Kit T",
			description: "Kit D",
		});
	});

	it("swaps the texts and keeps the kit layout", async () => {
		app.appMarketing = { pricingHeader: { title: "App T" } };
		const intro = (await render()).props.children as El;
		expect(intro.props).toEqual({
			align: "center",
			title: "App T",
			description: "Kit D",
		});
	});

	it("renders an app component in place of the whole header", async () => {
		const AppHeader = () => null;
		app.appMarketing = { pricingHeader: AppHeader };
		expect((await render()).type).toBe(AppHeader);
	});

	it("the pricing page renders it with the kit texts", () => {
		expect(
			read("apps/marketing/src/app/(marketing)/[locale]/pricing/page.tsx"),
		).toMatch(
			/<PricingPageHeader\s+title=\{t\("title"\)\}\s+description=\{t\("description"\)\}\s*\/>/,
		);
	});
});

describe("layout slot", () => {
	it("the marketing layout renders appMarketing.LayoutSlot once, with the locale", () => {
		const layout = read(
			"apps/marketing/src/app/(marketing)/[locale]/layout.tsx",
		);
		expect(layout).toMatch(/\{ appMarketing \} from "@\/app-marketing"/);
		expect(layout.match(/<LayoutSlot\b/g)).toHaveLength(1);
		expect(layout).toMatch(
			/\{LayoutSlot && <LayoutSlot locale=\{locale\} \/>\}/,
		);
	});
});

describe("sitemap", () => {
	const NOW = new Date("2026-11-14T00:00:00.000Z");
	const both = (path: string) => ({
		languages: {
			en: `https://site.test${path}`,
			de: `https://site.test/de${path}`,
		},
	});
	const page = (path: string, priority: number) =>
		["en", "de"].map((locale) => ({
			url: `https://site.test${locale === "en" ? "" : "/de"}${path}`,
			lastModified: NOW,
			changeFrequency: "weekly",
			priority,
			alternates: both(path),
		}));

	it("lists every page per enabled locale with hreflang alternates (kit default)", () => {
		expect(sitemap()).toEqual([
			...page("", 1),
			...page("/pricing", 0.7),
			...page("/blog", 0.7),
			...page("/changelog", 0.7),
			...page("/contact", 0.7),
			...page("/legal/privacy", 0.7),
			...["en", "de"].map((locale) => ({
				url: `https://site.test${locale === "en" ? "" : "/de"}/blog/hello`,
				lastModified: new Date("2026-01-02"),
				changeFrequency: "monthly",
				priority: 0.6,
				alternates: both("/blog/hello"),
			})),
		]);
	});

	it("lists only unprefixed default-locale URLs, no alternates, while i18n is disabled", () => {
		i18n.i18nConfig.enabled = false;
		const entries = sitemap();
		expect(entries.map((e) => e.url)).toEqual([
			"https://site.test",
			"https://site.test/pricing",
			"https://site.test/blog",
			"https://site.test/changelog",
			"https://site.test/contact",
			"https://site.test/legal/privacy",
			"https://site.test/blog/hello",
		]);
		for (const entry of entries) expect(entry.alternates).toBeUndefined();
	});

	it("emits app routes per routable locale after the kit routes, through the override hook", () => {
		const hook = vi.fn((route: { path: string }) =>
			route.path === "/sponsors" ? { priority: 0.3 } : undefined,
		);
		app.appMarketing = {
			sitemapRoutes: [
				{ path: "/support" },
				{
					path: "/sponsors",
					changeFrequency: "monthly",
					priority: 0.5,
					lastModified: new Date("2026-08-01"),
				},
			],
			sitemap: hook,
		};
		const entries = sitemap();
		expect(entries.slice(-4)).toEqual([
			...page("/support", 0.7),
			...["en", "de"].map((locale) => ({
				url: `https://site.test${locale === "en" ? "" : "/de"}/sponsors`,
				lastModified: new Date("2026-08-01"),
				changeFrequency: "monthly",
				priority: 0.3,
				alternates: both("/sponsors"),
			})),
		]);
		expect(hook).toHaveBeenCalledWith({
			path: "/sponsors",
			locale: "de",
			kind: "page",
			lastModified: new Date("2026-08-01"),
			changeFrequency: "monthly",
			priority: 0.5,
		});
	});

	it("accepts app routes from a function and lists them unprefixed while i18n is disabled", () => {
		i18n.i18nConfig.enabled = false;
		app.appMarketing = { sitemapRoutes: () => [{ path: "/support" }] };
		const last = sitemap().at(-1);
		expect(last).toEqual({
			url: "https://site.test/support",
			lastModified: NOW,
			changeFrequency: "weekly",
			priority: 0.7,
		});
	});

	it("throws on an app route that duplicates a kit or an earlier app route", () => {
		app.appMarketing = { sitemapRoutes: [{ path: "/pricing" }] };
		expect(() => sitemap()).toThrow(/duplicate sitemap path "\/pricing"/);
		app.appMarketing = {
			sitemapRoutes: [{ path: "/support" }, { path: "/support" }],
		};
		expect(() => sitemap()).toThrow(/duplicate sitemap path "\/support"/);
	});

	it("drops the entries the app excludes — kit pages, legal routes, posts and app routes", () => {
		const exclude = vi.fn(
			(route: { path: string; kind: string }) =>
				route.kind === "legal" ||
				route.path === "/blog/hello" ||
				route.path === "/changelog" ||
				route.path === "/sponsors",
		);
		app.appMarketing = {
			sitemapExclude: exclude,
			sitemapRoutes: [{ path: "/support" }, { path: "/sponsors" }],
		};
		expect(sitemap()).toEqual([
			...page("", 1),
			...page("/pricing", 0.7),
			...page("/blog", 0.7),
			...page("/contact", 0.7),
			...page("/support", 0.7),
		]);
		expect(exclude).toHaveBeenCalledWith({
			path: "/legal/privacy",
			locale: "de",
			kind: "legal",
			lastModified: NOW,
			changeFrequency: "weekly",
			priority: 0.7,
		});
		expect(exclude).toHaveBeenCalledWith(
			expect.objectContaining({ path: "/blog/hello", kind: "blog" }),
		);
	});

	it("drops an excluded locale from the hreflang alternates of the entries it keeps", () => {
		app.appMarketing = {
			sitemapExclude: (route: { path: string; locale: string }) =>
				route.path === "/pricing" && route.locale === "de",
		};
		const pricing = sitemap().filter((e) => e.url.endsWith("/pricing"));
		expect(pricing).toEqual([
			{
				url: "https://site.test/pricing",
				lastModified: NOW,
				changeFrequency: "weekly",
				priority: 0.7,
				alternates: { languages: { en: "https://site.test/pricing" } },
			},
		]);
	});

	it("never passes an excluded entry to the per-route hook", () => {
		const hook = vi.fn((_route: unknown) => undefined);
		app.appMarketing = {
			sitemapExclude: (route: { kind: string }) => route.kind !== "legal",
			sitemap: hook,
		};
		expect(sitemap().map((e) => e.url)).toEqual([
			"https://site.test/legal/privacy",
			"https://site.test/de/legal/privacy",
		]);
		expect(hook.mock.calls.map(([route]) => route)).toEqual([
			expect.objectContaining({ path: "/legal/privacy", locale: "en" }),
			expect.objectContaining({ path: "/legal/privacy", locale: "de" }),
		]);
	});

	it("applies the app's per-route values over the kit defaults", () => {
		const hook = vi.fn((route: { path: string; locale: string }) =>
			route.path === "/pricing"
				? {
						priority: 0.9,
						changeFrequency: "daily",
						lastModified: new Date("2026-10-01"),
					}
				: undefined,
		);
		app.appMarketing = { sitemap: hook };
		const entries = sitemap();
		const pricing = entries.filter((e) => e.url.endsWith("/pricing"));
		expect(pricing.map((e) => [e.priority, e.changeFrequency])).toEqual([
			[0.9, "daily"],
			[0.9, "daily"],
		]);
		expect(pricing[0]?.lastModified).toEqual(new Date("2026-10-01"));
		expect(entries.find((e) => e.url === "https://site.test")?.priority).toBe(
			1,
		);
		expect(hook).toHaveBeenCalledWith({
			path: "/blog/hello",
			locale: "de",
			kind: "blog",
			lastModified: new Date("2026-01-02"),
			changeFrequency: "monthly",
			priority: 0.6,
		});
		expect(hook).toHaveBeenCalledWith(
			expect.objectContaining({ path: "/legal/privacy", kind: "legal" }),
		);
		expect(hook).toHaveBeenCalledWith(
			expect.objectContaining({ path: "", kind: "page", locale: "en" }),
		);
	});

	it("omits switched-off kit pages and, with the blog off, its posts", () => {
		app.appKitRoutes = { blog: false, contact: false };
		expect(sitemap().map((e) => new URL(e.url).pathname)).toEqual([
			"/",
			"/de",
			"/pricing",
			"/de/pricing",
			"/changelog",
			"/de/changelog",
			"/legal/privacy",
			"/de/legal/privacy",
		]);
	});

	it("omits /pricing while payments are off", async () => {
		const { config } = await import("../../../config/index");
		(config.features as { payments: boolean }).payments = false;
		try {
			expect(
				sitemap().some((e) => new URL(e.url).pathname.endsWith("/pricing")),
			).toBe(false);
		} finally {
			(config.features as { payments: boolean }).payments = true;
		}
	});
});
