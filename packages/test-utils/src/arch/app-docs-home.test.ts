import { describe, expect, it } from "vitest";

/**
 * The kit docs home (`components/home/docs-home.tsx`) reads its sections
 * and "start here" pages from the page tree, so it never drifts from the
 * sidebar and works for any app's content. `appDocs.Home` still replaces it.
 */

const { docsSections } = await import(
	"../../../../apps/docs/src/lib/page-tree-sections"
);

// Page-tree types via the helper — fumadocs is a docs-app dependency only.
type Root = Parameters<typeof docsSections>[0];
type Node = Root["children"][number];
type Item = Extract<Node, { type: "page" }>;
type Folder = Extract<Node, { type: "folder" }>;

const page = (name: string, url: string, description?: string): Item => ({
	type: "page",
	name,
	url,
	description,
});

const folder = (
	name: string,
	children: Folder["children"],
	extra: Partial<Folder> = {},
): Folder => ({ type: "folder", name, children, ...extra });

describe("docs home sections from the page tree", () => {
	it("makes one section per top-level folder when the tree has no separators", () => {
		const tree: Root = {
			name: "Docs",
			children: [
				page("Introduction", "/docs"),
				folder("Getting Started", [
					page("Installation", "/docs/start/install", "Run it locally"),
					page("Configuration", "/docs/start/config"),
				]),
				folder("Guides", [
					folder("Deep", [page("Theming", "/docs/guides/deep/theming")]),
				]),
			],
		};

		expect(docsSections(tree)).toEqual([
			{
				key: "Getting Started",
				name: "Getting Started",
				icon: undefined,
				href: "/docs/start/install",
				pageCount: 2,
				pages: [
					{
						name: "Installation",
						url: "/docs/start/install",
						description: "Run it locally",
					},
					{
						name: "Configuration",
						url: "/docs/start/config",
						description: undefined,
					},
				],
			},
			{
				key: "Guides",
				name: "Guides",
				icon: undefined,
				href: "/docs/guides/deep/theming",
				pageCount: 1,
				pages: [
					{
						name: "Theming",
						url: "/docs/guides/deep/theming",
						description: undefined,
					},
				],
			},
		]);
	});

	it("groups by separator when the sidebar has separators", () => {
		const tree: Root = {
			name: "Docs",
			children: [
				page("Home", "/docs"),
				{ type: "separator", name: "Start" },
				page("Install", "/docs/install"),
				folder("Concepts", [page("Routing", "/docs/concepts/routing")], {
					index: page("Concepts", "/docs/concepts"),
				}),
				{ type: "separator", name: "Ship" },
				page("Deploy", "/docs/deploy"),
				{ type: "separator", name: "Empty" },
			],
		};

		const sections = docsSections(tree);
		expect(sections.map((s) => [s.name, s.href, s.pageCount])).toEqual([
			["Start", "/docs/install", 3],
			["Ship", "/docs/deploy", 1],
		]);
		expect(sections[0]?.pages.map((p) => p.url)).toEqual([
			"/docs/install",
			"/docs/concepts",
			"/docs/concepts/routing",
		]);
	});

	it("looks inside a single root folder", () => {
		const tree: Root = {
			name: "Docs",
			children: [
				folder("Product", [
					folder("Basics", [page("Start", "/docs/product/start")]),
				]),
			],
		};

		expect(docsSections(tree).map((s) => s.name)).toEqual(["Basics"]);
	});

	it("leaves out external links and sections without pages", () => {
		const tree: Root = {
			name: "Docs",
			children: [
				folder("Links", [
					{ ...page("GitHub", "https://github.com/x"), external: true },
				]),
				folder("Empty", []),
				folder("Real", [page("One", "/docs/real/one")]),
			],
		};

		expect(docsSections(tree).map((s) => s.name)).toEqual(["Real"]);
	});

	it("returns no sections for an empty tree", () => {
		expect(docsSections({ name: "Docs", children: [] })).toEqual([]);
	});
});
