import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const { withAppMetadata } = await import(
	"../../../../apps/marketing/src/lib/page-metadata"
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
	i18n.i18nConfig.enabled = true;
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-11-14T00:00:00.000Z"));
});
afterEach(() => {
	vi.useRealTimers();
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

	it("home and pricing pages pass their kit metadata through the app override", () => {
		expect(
			read("apps/marketing/src/app/(marketing)/[locale]/page.tsx"),
		).toMatch(
			/withAppMetadata\(\s*\{[\s\S]*?\},\s*appMarketing\.metadata\?\.home,\s*locale,?\s*\)/,
		);
		expect(
			read("apps/marketing/src/app/(marketing)/[locale]/pricing/page.tsx"),
		).toMatch(
			/withAppMetadata\(\s*\{[\s\S]*?\},\s*appMarketing\.metadata\?\.pricing,\s*locale,?\s*\)/,
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
});
