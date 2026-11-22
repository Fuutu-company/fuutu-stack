import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Render slots (`apps/saas/src/app-slots.tsx`): the kit pages render a
 * slot through `renderSlot` — a configured slot renders its component
 * with the page's props, an unset slot renders nothing.
 */

const SAAS = join(import.meta.dirname, "../../../../apps/saas");
const { renderSlot } = await import(
	"../../../../apps/saas/src/modules/app/slots"
);

// React lives in the app, not in this package (nor do its types).
type Element = NonNullable<ReturnType<typeof renderSlot>>;
const requireFromSaas = createRequire(join(SAAS, "package.json"));
const { createElement } = requireFromSaas("react") as {
	createElement: (
		type: unknown,
		props: unknown,
		...children: unknown[]
	) => Element;
};
const { renderToStaticMarkup } = requireFromSaas("react-dom/server") as {
	renderToStaticMarkup: (element: Element) => string;
};

function Usage({ orgSlug }: { orgSlug: string | null }) {
	return createElement("p", null, `usage:${orgSlug ?? "personal"}`);
}

const host = (slot: typeof Usage | undefined, orgSlug: string | null) =>
	renderToStaticMarkup(
		createElement("main", null, renderSlot(slot, { orgSlug })),
	);

describe("renderSlot", () => {
	it("renders a configured slot with the page's props", () => {
		expect(host(Usage, "acme")).toBe("<main><p>usage:acme</p></main>");
		expect(host(Usage, null)).toBe("<main><p>usage:personal</p></main>");
	});

	it("renders nothing for an unset slot", () => {
		expect(host(undefined, "acme")).toBe("<main></main>");
		expect(renderSlot(undefined, { orgSlug: "acme" })).toBeNull();
	});
});

describe("renderSlot with a fallback (replacing slots)", () => {
	const kitWidgets = () => createElement("p", null, "kit-widgets");

	it("renders the slot instead of the fallback when set", () => {
		expect(
			renderToStaticMarkup(
				createElement(
					"main",
					null,
					renderSlot(Usage, { orgSlug: "acme" }, kitWidgets()),
				),
			),
		).toBe("<main><p>usage:acme</p></main>");
	});

	it("renders the fallback when the slot is unset", () => {
		expect(
			renderToStaticMarkup(
				createElement(
					"main",
					null,
					renderSlot(undefined, { orgSlug: "acme" }, kitWidgets()),
				),
			),
		).toBe("<main><p>kit-widgets</p></main>");
	});
});

describe("host pages", () => {
	const PAGES: Record<string, string[]> = {
		"src/app/(app)/settings/page.tsx": ["userSettings"],
		"src/app/(app)/organizations/[slug]/settings/billing/page.tsx": [
			"orgBillingTop",
			"orgBillingBottom",
		],
		"src/app/(app)/dashboard/page.tsx": ["dashboard"],
		"src/app/(app)/organizations/[slug]/dashboard/page.tsx": ["dashboard"],
	};

	// Replacing slots: the kit content is the fallback, rendered only when
	// the app leaves the slot unset.
	const REPLACING: Record<string, { slot: string; fallback: string }> = {
		"src/app/(app)/dashboard/page.tsx": {
			slot: "dashboardMain",
			fallback: "<DashboardOverview",
		},
		"src/app/(app)/organizations/[slug]/dashboard/page.tsx": {
			slot: "dashboardMain",
			fallback: "<DashboardOverview",
		},
	};

	for (const [page, { slot, fallback }] of Object.entries(REPLACING)) {
		it(`${page} renders ${slot} in place of the kit widgets`, () => {
			const source = readFileSync(join(SAAS, page), "utf8");
			// The kit widgets are the fallback argument of the slot's renderSlot.
			expect(source).toMatch(
				new RegExp(
					`renderSlot\\(\\s*appSlots\\.${slot},[^)]*\\},\\s*${fallback}`,
				),
			);
			expect(source.match(/<DashboardOverview/g)).toHaveLength(1);
		});
	}

	for (const [page, slots] of Object.entries(PAGES)) {
		it(`${page} renders ${slots.join(", ")} through renderSlot`, () => {
			const source = readFileSync(join(SAAS, page), "utf8");
			for (const slot of slots) {
				expect(source).toContain(`renderSlot(appSlots.${slot},`);
			}
		});
	}
});

describe("appSlots.authLogo (auth pages)", () => {
	const layout = readFileSync(join(SAAS, "src/app/auth/layout.tsx"), "utf8");

	it("replaces the logo mark above the card; the kit logo is the fallback", () => {
		expect(layout).toMatch(
			/renderSlot\(\s*appSlots\.authLogo,\s*\{\},\s*<BrandLogo size="lg" className="dark:invert" \/>,?\s*\)/,
		);
		expect(layout.match(/<BrandLogo\b/g)).toHaveLength(1);
	});

	it("is declared as an optional component slot", () => {
		const slots = readFileSync(join(SAAS, "src/modules/app/slots.ts"), "utf8");
		expect(slots).toMatch(/\bauthLogo\?: ComponentType;/);
	});
});
