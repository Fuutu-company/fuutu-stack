import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * `appMarketing.notFoundLinks` — section links under the home button on
 * the marketing 404 pages. Unset (or empty): nothing extra renders, the
 * page keeps only the kit's home button.
 */

const ROOT = join(import.meta.dirname, "../../../..");
const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

const IntlLink = () => null;
vi.mock("@/navigation", () => ({ Link: IntlLink }));

type El = { type: unknown; props: Record<string, unknown> };
// Non-literal path: a `.tsx` module this package's tsc (no JSX) must not
// follow; vitest resolves it like any import.
const LINKS = join(
	ROOT,
	"apps/marketing/src/modules/shared/components/not-found-links.tsx",
);
const { NotFoundLinks } = (await import(/* @vite-ignore */ LINKS)) as {
	NotFoundLinks: (props: object) => El | null;
};

const links = [
	{ href: "/blog", label: "Blog" },
	{ href: "https://docs.test", label: "Docs", external: true },
];
const items = (el: El | null) => {
	const list = (el?.props.children ?? []) as El[];
	return (Array.isArray(list) ? list : [list]).map((li) => {
		const child = li.props.children as El;
		return { type: child.type, ...child.props };
	});
};

describe("not-found links", () => {
	it("renders nothing without app links", () => {
		expect(NotFoundLinks({ label: "More", links: [] })).toBeNull();
	});

	it("renders a labelled nav: locale-aware links in-app, new-tab anchors outside", () => {
		const el = NotFoundLinks({ label: "More", links });
		expect(el?.type).toBe("nav");
		expect(el?.props["aria-label"]).toBe("More");
		const ul = el?.props.children as El;
		expect(ul.type).toBe("ul");
		expect(items(ul)).toMatchObject([
			{ type: IntlLink, href: "/blog", children: "Blog" },
			{
				type: "a",
				href: "https://docs.test",
				target: "_blank",
				rel: "noopener noreferrer",
				children: "Docs",
			},
		]);
	});

	it("uses plain anchors with the given href mapping outside the intl provider", () => {
		const el = NotFoundLinks({
			label: "More",
			links,
			hrefFor: (href: string) => `/de${href}`,
		});
		expect(items(el?.props.children as El)).toMatchObject([
			{ type: "a", href: "/de/blog", children: "Blog" },
			{ type: "a", href: "https://docs.test", target: "_blank" },
		]);
	});

	it("both marketing 404 pages pass appMarketing.notFoundLinks", () => {
		for (const file of [
			"apps/marketing/src/app/not-found.tsx",
			"apps/marketing/src/app/(marketing)/[locale]/not-found.tsx",
		]) {
			const src = read(file);
			expect(src, file).toMatch(/\{ appMarketing \} from "@\/app-marketing"/);
			expect(src, file).toMatch(/appMarketing\.notFoundLinks/);
			expect(src, file).toMatch(/<NotFoundLinks\b/);
		}
	});
});
