import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * App-owned marketing extensions: home-section composition
 * (`app-marketing.tsx` → `composeHomeSections`), extra nav items, dropdown
 * items, footer columns and the header brand (`app-site-links.ts` →
 * `lib/site-links.ts`) and the pricing-cards
 * override (`app-marketing.tsx` → `modules/marketing/pricing`). The app
 * files are mocked so each test controls the extras; empty extras must
 * reproduce the kit output exactly.
 */

const ROOT = join(import.meta.dirname, "../../../..");

const app = vi.hoisted(() => ({
	appNavItems: [] as unknown[],
	appFooterColumns: [] as unknown[],
	appNavDropdownItems: [] as unknown[],
	appHeaderBrand: {} as Record<string, unknown>,
	appNavDropdowns: [] as unknown[],
	appNavRemove: [] as string[],
	appFooter: {} as Record<string, unknown>,
	appKitRoutes: {} as Record<string, unknown>,
	appMarketing: {} as Record<string, unknown>,
	consentBannerVisible: true,
}));

vi.mock("../../../../apps/marketing/src/app-site-links", () => ({
	get appNavItems() {
		return app.appNavItems;
	},
	get appFooterColumns() {
		return app.appFooterColumns;
	},
	get appNavDropdownItems() {
		return app.appNavDropdownItems;
	},
	get appHeaderBrand() {
		return app.appHeaderBrand;
	},
	get appNavDropdowns() {
		return app.appNavDropdowns;
	},
	get appNavRemove() {
		return app.appNavRemove;
	},
	get appFooter() {
		return app.appFooter;
	},
	get appKitRoutes() {
		return app.appKitRoutes;
	},
}));
vi.mock("@/app-marketing", () => ({
	get appMarketing() {
		return app.appMarketing;
	},
}));
vi.mock("../../../../packages/analytics/src/index.ts", () => ({
	consentBannerVisible: () => app.consentBannerVisible,
}));
vi.mock(
	"../../../../apps/marketing/src/modules/marketing/components/privacy-settings-action",
	() => ({ PrivacySettingsAction: () => null }),
);
vi.mock("../../../../apps/marketing/src/lib/urls", () => ({
	urls: { docs: "https://docs.example.test" },
}));
const KitHome = () => null;
const KitPage = () => null;
vi.mock(
	"../../../../apps/marketing/src/modules/marketing/pricing/components/pricing-cards",
	() => ({ PricingCardsHome: KitHome, PricingCardsPage: KitPage }),
);

const { composeHomeSections } = await import(
	"../../../../apps/marketing/src/modules/marketing/home/compose-sections"
);

const Hero = () => null;
const Faq = () => null;
const Custom = () => null;
const kit = () => [
	{ key: "hero", Component: Hero },
	{ key: "pricing", Component: Hero },
	{ key: "faq", Component: Faq },
];
const keys = (sections: { key: string }[]) => sections.map((s) => s.key);

beforeEach(() => {
	app.appNavItems = [];
	app.appFooterColumns = [];
	app.appNavDropdownItems = [];
	app.appHeaderBrand = {};
	app.appNavDropdowns = [];
	app.appNavRemove = [];
	app.appFooter = {};
	app.appKitRoutes = {};
	app.appMarketing = {};
	app.consentBannerVisible = true;
	vi.resetModules();
});

describe("composeHomeSections", () => {
	it("returns the kit sections unchanged without app config", () => {
		const base = kit();
		expect(composeHomeSections(base, undefined)).toEqual(base);
		expect(composeHomeSections(base, {})).toEqual(base);
	});

	it("inserts an app section after a kit key, or appends it", () => {
		const result = composeHomeSections(kit(), {
			insert: [
				{ key: "demo", after: "hero", Component: Custom },
				{ key: "tail", Component: Custom },
			],
		});
		expect(keys(result)).toEqual(["hero", "demo", "pricing", "faq", "tail"]);
	});

	it("replaces a kit section's component and keeps its position", () => {
		const result = composeHomeSections(kit(), {
			replace: { pricing: Custom },
		});
		expect(keys(result)).toEqual(["hero", "pricing", "faq"]);
		expect(result[1]?.Component).toBe(Custom);
		expect(result[2]?.Component).toBe(Faq);
	});

	it("removes kit sections by key; an insert anchored on one keeps its spot", () => {
		const result = composeHomeSections(kit(), {
			remove: ["pricing"],
			insert: [{ key: "plans", after: "pricing", Component: Custom }],
		});
		expect(keys(result)).toEqual(["hero", "plans", "faq"]);
	});

	it("throws on an app section reusing a kit key", () => {
		expect(() =>
			composeHomeSections(kit(), {
				insert: [{ key: "faq", Component: Custom }],
			}),
		).toThrow(/duplicate key "faq"/);
	});
});

/** The `site-links` exports these tests read — typed here so tsc never follows the module. */
type SiteLinksModule = {
	NAV_ITEMS: { key: string }[];
	NAV_DROPDOWNS: { key: string; items: { key: string }[] }[];
	NAV_ORDER: { kind: string; key: string }[];
	FOOTER_COLUMNS: { titleKey: string; links: { href: string }[] }[];
	FOOTER_ACTIONS: { key: string; column: string }[];
	FOOTER_TAGLINE_KEY: string;
	FOOTER_AREA_LINE: { textKey: string; Mark: unknown } | null;
	HEADER_BRAND: { Brand?: unknown };
};

describe("site links", () => {
	// Non-literal path: app-site-links may import `.tsx` (footer actions),
	// which this package's tsc must not follow.
	const load = () =>
		import(
			/* @vite-ignore */ join(ROOT, "apps/marketing/src/lib/site-links.ts")
		) as Promise<SiteLinksModule>;

	it("keeps the kit nav items and footer columns without app extras", async () => {
		const links = await load();
		expect(links.NAV_ITEMS.map((i: { key: string }) => i.key)).toEqual([
			"home",
			"features",
			"pricing",
		]);
		expect(
			links.FOOTER_COLUMNS.map((c: { titleKey: string }) => c.titleKey),
		).toEqual(["product", "resources", "companyAndLegal"]);
	});

	it("throws on a duplicate footer column titleKey", async () => {
		app.appFooterColumns = [{ titleKey: "product", links: [] }];
		await expect(load()).rejects.toThrow(/duplicate.*"product"/);
	});

	it("places app nav items after their anchor and appends footer columns", async () => {
		app.appNavItems = [
			{ key: "showcase", href: "/showcase", after: "home" },
			{ key: "partners", href: "/partners" },
		];
		app.appFooterColumns = [
			{ titleKey: "community", links: [{ href: "/x", labelKey: "nav.x" }] },
		];
		const links = await load();
		expect(links.NAV_ITEMS.map((i: { key: string }) => i.key)).toEqual([
			"home",
			"showcase",
			"features",
			"pricing",
			"partners",
		]);
		expect(
			links.FOOTER_COLUMNS.map((c: { titleKey: string }) => c.titleKey),
		).toEqual(["product", "resources", "companyAndLegal", "community"]);
	});

	const dropdownKeys = (links: {
		NAV_DROPDOWNS: { key: string; items: { key: string }[] }[];
	}) => links.NAV_DROPDOWNS.map((g) => [g.key, g.items.map((i) => i.key)]);

	it("keeps the kit dropdown groups without app items", async () => {
		expect(dropdownKeys(await load())).toEqual([
			["resources", ["blog", "changelog", "docs"]],
		]);
	});

	it("places app dropdown items in their group, after their anchor or appended", async () => {
		const Icon = () => null;
		app.appNavDropdownItems = [
			{ group: "resources", key: "guides", href: "/guides", icon: Icon },
			{
				group: "resources",
				key: "community",
				href: "https://discord.test",
				external: true,
				after: "blog",
				icon: Icon,
			},
		];
		const links = await load();
		expect(dropdownKeys(links)).toEqual([
			["resources", ["blog", "community", "changelog", "docs", "guides"]],
		]);
		const community = links.NAV_DROPDOWNS[0]?.items[1] as Record<
			string,
			unknown
		>;
		expect(community).toEqual({
			key: "community",
			href: "https://discord.test",
			external: true,
			icon: Icon,
		});
	});

	it("throws on an unknown dropdown group and on a duplicate item key", async () => {
		const Icon = () => null;
		app.appNavDropdownItems = [
			{ group: "company", key: "about", href: "/about", icon: Icon },
		];
		await expect(load()).rejects.toThrow(/unknown dropdown group "company"/);
		vi.resetModules();
		app.appNavDropdownItems = [
			{ group: "resources", key: "blog", href: "/b", icon: Icon },
		];
		await expect(load()).rejects.toThrow(/duplicate key "blog"/);
	});

	const order = (links: { NAV_ORDER: { kind: string; key: string }[] }) =>
		links.NAV_ORDER.map((e) => `${e.kind}:${e.key}`);

	it("orders the top-level navbar as kit items, then kit dropdowns", async () => {
		expect(order(await load())).toEqual([
			"item:home",
			"item:features",
			"item:pricing",
			"dropdown:resources",
		]);
	});

	it("places app dropdown groups after a nav or dropdown key, or appended", async () => {
		const Icon = () => null;
		app.appNavDropdowns = [
			{
				key: "product",
				after: "features",
				items: [{ key: "agents", href: "/agents", icon: Icon }],
			},
			{ key: "company", items: [{ key: "about", href: "/about", icon: Icon }] },
		];
		app.appNavDropdownItems = [
			{ group: "product", key: "compare", href: "/compare", icon: Icon },
		];
		const links = await load();
		expect(order(links)).toEqual([
			"item:home",
			"item:features",
			"dropdown:product",
			"item:pricing",
			"dropdown:resources",
			"dropdown:company",
		]);
		// Same order for the mobile menu, which lists every group after the links.
		expect(dropdownKeys(links)).toEqual([
			["product", ["agents", "compare"]],
			["resources", ["blog", "changelog", "docs"]],
			["company", ["about"]],
		]);
	});

	it("throws on an app dropdown reusing an existing key", async () => {
		app.appNavDropdowns = [{ key: "pricing", items: [] }];
		await expect(load()).rejects.toThrow(/duplicate key "pricing"/);
	});

	it("removes kit nav items, dropdown items and whole groups by key", async () => {
		app.appNavRemove = ["home", "features", "changelog"];
		let links = await load();
		expect(links.NAV_ITEMS.map((i: { key: string }) => i.key)).toEqual([
			"pricing",
		]);
		expect(order(links)).toEqual(["item:pricing", "dropdown:resources"]);
		expect(dropdownKeys(links)).toEqual([["resources", ["blog", "docs"]]]);

		vi.resetModules();
		app.appNavRemove = ["resources"];
		links = await load();
		expect(order(links)).toEqual([
			"item:home",
			"item:features",
			"item:pricing",
		]);
		expect(dropdownKeys(links)).toEqual([]);
	});

	it("keeps an app item anchored on a removed kit item at its position", async () => {
		app.appNavItems = [{ key: "product", href: "/product", after: "features" }];
		app.appNavRemove = ["features"];
		const links = await load();
		expect(links.NAV_ITEMS.map((i: { key: string }) => i.key)).toEqual([
			"home",
			"product",
			"pricing",
		]);
	});

	it("throws on a remove key that names nothing", async () => {
		app.appNavRemove = ["feautres"];
		await expect(load()).rejects.toThrow(/unknown nav key "feautres"/);
	});

	it("uses the kit footer tagline key unless the app names its own", async () => {
		expect((await load()).FOOTER_TAGLINE_KEY).toBe("footer.tagline");
		vi.resetModules();
		app.appFooter = { taglineKey: "platform.footerTagline" };
		expect((await load()).FOOTER_TAGLINE_KEY).toBe("platform.footerTagline");
	});

	it("keeps the kit footer area line + mark unless the app changes it", async () => {
		expect((await load()).FOOTER_AREA_LINE).toEqual({
			textKey: "footer.areas",
			Mark: undefined,
		});
	});

	it("replaces the footer area line text and mark, or removes the mark", async () => {
		const Mark = () => null;
		app.appFooter = { areaLine: { textKey: "platform.footerArea", Mark } };
		expect((await load()).FOOTER_AREA_LINE).toEqual({
			textKey: "platform.footerArea",
			Mark,
		});
		vi.resetModules();
		app.appFooter = { areaLine: { Mark: null } };
		expect((await load()).FOOTER_AREA_LINE).toEqual({
			textKey: "footer.areas",
			Mark: null,
		});
	});

	it("removes the footer area line with areaLine: false", async () => {
		app.appFooter = { areaLine: false };
		expect((await load()).FOOTER_AREA_LINE).toBeNull();
	});

	const actionKeys = (links: SiteLinksModule) =>
		links.FOOTER_ACTIONS.map((a) => [a.key, a.column]);

	it("has only the kit Privacy settings action without app extras", async () => {
		expect(actionKeys(await load())).toEqual([
			["privacySettings", "companyAndLegal"],
		]);
	});

	it("drops the Privacy settings action while the consent banner is off", async () => {
		app.consentBannerVisible = false;
		expect((await load()).FOOTER_ACTIONS).toEqual([]);
	});

	it("keeps app footer actions in declaration order, in kit or app columns", async () => {
		const Gate = () => null;
		app.appFooterColumns = [{ titleKey: "community", links: [] }];
		app.appFooter = {
			actions: [
				{
					key: "joinDiscord",
					column: "community",
					labelKey: "footer.join",
					Component: Gate,
				},
				{
					key: "feedback",
					column: "companyAndLegal",
					labelKey: "footer.fb",
					Component: Gate,
				},
			],
		};
		expect(actionKeys(await load())).toEqual([
			["privacySettings", "companyAndLegal"],
			["joinDiscord", "community"],
			["feedback", "companyAndLegal"],
		]);
	});

	it("throws on a footer action in an unknown column", async () => {
		app.appFooter = {
			actions: [
				{
					key: "join",
					column: "nope",
					labelKey: "footer.join",
					Component: () => null,
				},
			],
		};
		await expect(load()).rejects.toThrow(/unknown footer column "nope"/);
	});

	it("throws on a duplicate footer action key", async () => {
		const action = {
			key: "join",
			column: "resources",
			labelKey: "footer.join",
			Component: () => null,
		};
		app.appFooter = { actions: [action, action] };
		await expect(load()).rejects.toThrow(/duplicate footer action key "join"/);
	});

	it("exposes the app header brand to the navbar (kit brand when unset)", async () => {
		expect((await load()).HEADER_BRAND).toEqual({});
		vi.resetModules();
		const Brand = () => null;
		app.appHeaderBrand = { Brand };
		expect((await load()).HEADER_BRAND.Brand).toBe(Brand);
	});
});

describe("kit routes (appKitRoutes)", () => {
	type KitRoutes = {
		isKitRouteEnabled: (route: string) => boolean;
		isKitPathEnabled: (path: string) => boolean;
	};
	const kitRoutes = () =>
		import(
			/* @vite-ignore */ join(ROOT, "apps/marketing/src/lib/kit-routes.ts")
		) as Promise<KitRoutes>;
	const loadLinks = () =>
		import(
			/* @vite-ignore */ join(ROOT, "apps/marketing/src/lib/site-links.ts")
		) as Promise<SiteLinksModule>;
	const hrefs = (links: SiteLinksModule) => ({
		nav: links.NAV_ITEMS.map((i: { key: string }) => i.key),
		dropdowns: links.NAV_DROPDOWNS.map((g) => [
			g.key,
			g.items.map((i) => i.key),
		]),
		footer: links.FOOTER_COLUMNS.flatMap((c) => c.links.map((l) => l.href)),
	});

	it("serves every kit page by default", async () => {
		const { isKitRouteEnabled } = await kitRoutes();
		for (const route of ["pricing", "blog", "changelog", "contact"]) {
			expect(isKitRouteEnabled(route), route).toBe(true);
		}
	});

	it("switches a page off with false, and only that page", async () => {
		app.appKitRoutes = { blog: false };
		const { isKitRouteEnabled } = await kitRoutes();
		expect(isKitRouteEnabled("blog")).toBe(false);
		expect(isKitRouteEnabled("changelog")).toBe(true);
	});

	it("turns pricing off while payments are off", async () => {
		const { config } = await import("../../../config/index");
		(config.features as { payments: boolean }).payments = false;
		try {
			const { isKitRouteEnabled } = await kitRoutes();
			expect(isKitRouteEnabled("pricing")).toBe(false);
			expect(isKitRouteEnabled("blog")).toBe(true);
		} finally {
			(config.features as { payments: boolean }).payments = true;
		}
	});

	it("matches paths of a disabled page, ignoring hash, query and locale-free subpaths", async () => {
		app.appKitRoutes = { blog: false, pricing: false };
		const { isKitPathEnabled } = await kitRoutes();
		expect(isKitPathEnabled("/blog")).toBe(false);
		expect(isKitPathEnabled("/blog/hello")).toBe(false);
		expect(isKitPathEnabled("/pricing#faq")).toBe(false);
		expect(isKitPathEnabled("/pricing?x=1")).toBe(false);
		expect(isKitPathEnabled("/blogger")).toBe(true);
		expect(isKitPathEnabled("/")).toBe(true);
		expect(isKitPathEnabled("/#features")).toBe(true);
		expect(isKitPathEnabled("/contact")).toBe(true);
		expect(isKitPathEnabled("/legal/privacy")).toBe(true);
	});

	it("lists every kit link while nothing is switched off", async () => {
		expect(hrefs(await loadLinks())).toEqual({
			nav: ["home", "features", "pricing"],
			dropdowns: [["resources", ["blog", "changelog", "docs"]]],
			footer: [
				"/#features",
				"/pricing",
				"/changelog",
				"https://docs.example.test",
				"/blog",
				"/contact",
				"/legal/privacy",
				"/legal/terms",
				"/legal/imprint",
			],
		});
	});

	it("drops navbar and footer links to switched-off pages", async () => {
		app.appKitRoutes = { pricing: false, blog: false, contact: false };
		const links = await loadLinks();
		expect(hrefs(links)).toEqual({
			nav: ["home", "features"],
			dropdowns: [["resources", ["changelog", "docs"]]],
			footer: [
				"/#features",
				"/changelog",
				"https://docs.example.test",
				"/legal/privacy",
				"/legal/terms",
				"/legal/imprint",
			],
		});
		expect(links.NAV_ORDER.map((e: { key: string }) => e.key)).toEqual([
			"home",
			"features",
			"resources",
		]);
	});

	it("drops a dropdown left without items", async () => {
		app.appKitRoutes = { blog: false, changelog: false, pricing: false };
		app.appNavRemove = ["docs"];
		const links = await loadLinks();
		expect(links.NAV_DROPDOWNS).toEqual([]);
		expect(links.NAV_ORDER.map((e: { key: string }) => e.key)).toEqual([
			"home",
			"features",
		]);
		expect(
			links.FOOTER_COLUMNS.map((c: { titleKey: string }) => c.titleKey),
		).toEqual(["product", "resources", "companyAndLegal"]);
	});

	it("does not throw when appNavRemove names a page that is switched off", async () => {
		app.appKitRoutes = { blog: false };
		app.appNavRemove = ["blog"];
		await expect(loadLinks()).resolves.toBeDefined();
	});
});

describe("navbar order and footer tagline wiring", () => {
	const read = (file: string) =>
		readFileSync(join(ROOT, "apps/marketing/src", file), "utf8");

	it("the desktop navbar renders the top level in NAV_ORDER", () => {
		const navbar = read("modules/marketing/components/navbar.tsx");
		expect(navbar).toMatch(/NAV_ORDER\.map\(/);
	});

	it("the footer renders the tagline from FOOTER_TAGLINE_KEY", () => {
		const footer = read("modules/marketing/components/footer.tsx");
		expect(footer).toMatch(/t\(FOOTER_TAGLINE_KEY\)/);
		expect(footer).not.toMatch(/t\("footer\.tagline"\)/);
	});

	it("the footer renders the area line from FOOTER_AREA_LINE (kit mark when Mark is unset)", () => {
		const footer = read("modules/marketing/components/footer.tsx");
		expect(footer).toMatch(/\{FOOTER_AREA_LINE && \(/);
		expect(footer).toMatch(/t\(FOOTER_AREA_LINE\.textKey\)/);
		expect(footer).toMatch(
			/FOOTER_AREA_LINE\.Mark === undefined\s*\?\s*AreaMark\s*:\s*FOOTER_AREA_LINE\.Mark/,
		);
		expect(footer).not.toMatch(/t\("footer\.areas"\)/);
	});
});

describe("footer action rendering", () => {
	const MARKETING = join(ROOT, "apps/marketing");
	const requireFromMarketing = createRequire(join(MARKETING, "package.json"));
	type El = { type: unknown; props: Record<string, unknown> };
	const { createElement } = requireFromMarketing("react") as {
		createElement: (
			type: unknown,
			props: unknown,
			...children: unknown[]
		) => El;
	};
	const { renderToStaticMarkup } = requireFromMarketing("react-dom/server") as {
		renderToStaticMarkup: (element: El) => string;
	};

	it("renders the app component around a kit-styled <button> with the label", async () => {
		// Non-literal path: a `.tsx` module this package's tsc must not follow.
		const { FooterActionItem, FOOTER_LINK_CLASS } = (await import(
			/* @vite-ignore */ join(
				MARKETING,
				"src/modules/marketing/components/footer-action.tsx",
			)
		)) as { FooterActionItem: unknown; FOOTER_LINK_CLASS: string };
		const Gate = ({ trigger }: { trigger: unknown }) =>
			createElement("span", { "data-gate": "" }, trigger);
		const html = renderToStaticMarkup(
			createElement(
				"ul",
				null,
				createElement(FooterActionItem, {
					action: {
						key: "join",
						column: "resources",
						labelKey: "footer.join",
						Component: Gate,
					},
					label: "Join the community",
				}),
			),
		);
		expect(html).toBe(
			`<ul><li><span data-gate=""><button type="button" class="${FOOTER_LINK_CLASS} cursor-pointer">Join the community</button></span></li></ul>`,
		);
	});

	it("the footer renders each column's actions after its links, labels via t()", () => {
		const footer = readFileSync(
			join(ROOT, "apps/marketing/src/modules/marketing/components/footer.tsx"),
			"utf8",
		);
		expect(footer).toMatch(
			/FOOTER_ACTIONS\.filter\(\s*\(action\) => action\.column === column\.titleKey,?\s*\)/,
		);
		expect(footer).toMatch(
			/<FooterActionItem[\s\S]*?label=\{t\(action\.labelKey\)\}/,
		);
		// Links stay before actions inside the column list.
		expect(footer.indexOf("column.links.map")).toBeLessThan(
			footer.indexOf("FOOTER_ACTIONS.filter"),
		);
	});
});

describe("navbar brand", () => {
	const navbar = readFileSync(
		join(ROOT, "apps/marketing/src/modules/marketing/components/navbar.tsx"),
		"utf8",
	);

	it("renders the app Brand in place of the kit logo + name, else the kit brand", () => {
		expect(navbar).toMatch(/HEADER_BRAND/);
		expect(navbar).toMatch(
			/\{Brand \? \(\s*<Brand \/>\s*\) : \(\s*<>\s*<BrandLogo[\s\S]*?\{config\.app\.name\}\s*<\/span>\s*<\/>\s*\)\}/,
		);
	});

	it("renders the app After component behind the brand inside the home link", () => {
		expect(navbar).toMatch(/\{After && <After \/>\}\s*<\/Link>/);
	});
});

describe("pricing cards override", () => {
	// Non-literal path: the module imports `.tsx` files this package's tsc
	// (no JSX) must not follow; vitest resolves it like any import.
	const PRICING = join(
		ROOT,
		"apps/marketing/src/modules/marketing/pricing/index.ts",
	);
	const load = async () =>
		(await import(/* @vite-ignore */ PRICING)) as {
			PricingCardsHome: unknown;
			PricingCardsPage: unknown;
		};

	const rendered = (wrapper: unknown) =>
		(wrapper as () => { type: unknown })().type;

	it("renders the kit pricing cards without an override", async () => {
		const pricing = await load();
		expect(rendered(pricing.PricingCardsHome)).toBe(KitHome);
		expect(rendered(pricing.PricingCardsPage)).toBe(KitPage);
	});

	it("renders the app's pricing cards when set", async () => {
		const AppHome = () => null;
		const AppPage = () => null;
		app.appMarketing = { PricingCards: { Home: AppHome, Page: AppPage } };
		const pricing = await load();
		expect(rendered(pricing.PricingCardsHome)).toBe(AppHome);
		expect(rendered(pricing.PricingCardsPage)).toBe(AppPage);
	});

	it("reads appMarketing at render, not at module load (import-cycle safe)", async () => {
		const AppHome = () => null;
		app.appMarketing = new Proxy(
			{},
			{
				get() {
					throw new Error("appMarketing read at module load");
				},
			},
		);
		const pricing = await load();
		app.appMarketing = { PricingCards: { Home: AppHome } };
		expect(rendered(pricing.PricingCardsHome)).toBe(AppHome);
	});
});

describe("home page", () => {
	it("renders the composed section list in the kit order", () => {
		const page = readFileSync(
			join(ROOT, "apps/marketing/src/app/(marketing)/[locale]/page.tsx"),
			"utf8",
		);
		const order = [
			"hero",
			"integrations",
			"features",
			"product-tour",
			"security",
			"pricing",
			"faq",
			"cta",
		].map((key) => page.indexOf(`key: "${key}"`));
		expect(order.every((i) => i > -1)).toBe(true);
		expect([...order].sort((a, b) => a - b)).toEqual(order);
		expect(page).toMatch(
			/composeHomeSections\(\s*KIT_HOME_SECTIONS,\s*appMarketing\.homeSections,?\s*\)/,
		);
	});
});
