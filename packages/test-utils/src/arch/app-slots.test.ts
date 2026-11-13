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

	for (const [page, slots] of Object.entries(PAGES)) {
		it(`${page} renders ${slots.join(", ")} through renderSlot`, () => {
			const source = readFileSync(join(SAAS, page), "utf8");
			for (const slot of slots) {
				expect(source).toContain(`renderSlot(appSlots.${slot},`);
			}
		});
	}
});
