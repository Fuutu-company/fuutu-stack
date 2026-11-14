import { readFileSync } from "node:fs";
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
	appMarketing: {} as Record<string, unknown>,
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
}));
vi.mock("@/app-marketing", () => ({
	get appMarketing() {
		return app.appMarketing;
	},
}));
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
	app.appMarketing = {};
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

describe("site links", () => {
	const load = () => import("../../../../apps/marketing/src/lib/site-links");

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

	it("exposes the app header brand to the navbar (kit brand when unset)", async () => {
		expect((await load()).HEADER_BRAND).toEqual({});
		vi.resetModules();
		const Brand = () => null;
		app.appHeaderBrand = { Brand };
		expect((await load()).HEADER_BRAND.Brand).toBe(Brand);
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
