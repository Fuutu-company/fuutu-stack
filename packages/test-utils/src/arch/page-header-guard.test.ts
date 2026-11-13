import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: SaaS pages title themselves with `PageHeader` from `@fuutu/ui`
 * and group content in `Card`, so every page shares one heading style and one
 * surface style. Hand-built `<h1>` blocks and bordered divs drift from it.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const SCAN_DIRS = ["apps/saas/src"];
/** Own their heading: the design-system specimens and the onboarding wizard. */
const H1_ALLOWLIST = [
	"apps/saas/src/modules/app/design-system/",
	"apps/saas/src/modules/app/onboarding/",
];

const H1 = /<h1[\s>]/;
/** A bordered surface built by hand: `border … bg-card`, or a bordered table wrapper. */
const ADHOC_CARD =
	/className="[^"]*(?<![\w-])(border [^"]*\bbg-card\b|bg-card [^"]*(?<![\w-])border(?=[\s"]))|className="overflow-hidden rounded-\w+ border"/;

const HINT =
	'Use PageHeader (title, description, actions, area) for the page title and Card for surfaces; tables go in <Card className="overflow-hidden py-0">. See DESIGN.md.';

function walk(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		if (name === "__tests__" || name === "node_modules" || name === ".next") {
			continue;
		}
		const full = join(dir, name);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (/\.tsx$/.test(name)) out.push(full);
	}
	return out;
}

function findHits(pattern: RegExp, allowlist: string[]): string[] {
	const hits: string[] = [];
	for (const dir of SCAN_DIRS) {
		for (const file of walk(join(REPO_ROOT, dir))) {
			const rel = relative(REPO_ROOT, file);
			if (allowlist.some((prefix) => rel.startsWith(prefix))) continue;
			readFileSync(file, "utf8")
				.split("\n")
				.forEach((line, i) => {
					if (pattern.test(line)) hits.push(`${rel}:${i + 1}`);
				});
		}
	}
	return hits;
}

/**
 * The app header's breadcrumb already names the page, so app pages use
 * `<PageHeader variant="compact">`: a visually hidden h1 plus the actions
 * row. Only the dashboard greeting and the `/design` intro (and the
 * design-system specimen showing the default variant) keep a visible title.
 */
const VISIBLE_TITLE_ALLOWLIST = [
	"apps/saas/src/modules/app/dashboard/components/dashboard-overview.tsx",
	"apps/saas/src/modules/app/design-system/",
];

interface PageHeaderUse {
	rel: string;
	total: number;
	compact: number;
}

function pageHeaderUses(): PageHeaderUse[] {
	const uses: PageHeaderUse[] = [];
	for (const dir of SCAN_DIRS) {
		for (const file of walk(join(REPO_ROOT, dir))) {
			const source = readFileSync(file, "utf8");
			const total = source.match(/<PageHeader\b/g)?.length ?? 0;
			if (total === 0) continue;
			uses.push({
				rel: relative(REPO_ROOT, file),
				total,
				compact: source.match(/\bvariant="compact"/g)?.length ?? 0,
			});
		}
	}
	return uses;
}

describe("page header guard", () => {
	it("app pages use the compact PageHeader (the breadcrumb names the page)", () => {
		const uses = pageHeaderUses();
		expect(uses.length).toBeGreaterThan(10);
		const visible = uses
			.filter(
				({ rel }) =>
					!VISIBLE_TITLE_ALLOWLIST.some((prefix) => rel.startsWith(prefix)),
			)
			.filter(({ total, compact }) => compact !== total)
			.map(({ rel }) => rel);
		expect(
			visible,
			'Use <PageHeader variant="compact" title=… actions=…>: the h1 stays for screen readers, the breadcrumb shows the location.',
		).toEqual([]);
	});

	it("the dashboard greeting keeps its visible title", () => {
		const dashboard = pageHeaderUses().find(({ rel }) =>
			rel.endsWith("dashboard/components/dashboard-overview.tsx"),
		);
		expect(dashboard).toEqual(
			expect.objectContaining({ total: 1, compact: 0 }),
		);
	});

	it("has no <h1 outside PageHeader, AuthCard, design-system and onboarding", () => {
		expect(findHits(H1, H1_ALLOWLIST), HINT).toEqual([]);
	});

	it("has no ad-hoc bordered card divs", () => {
		expect(
			findHits(ADHOC_CARD, ["apps/saas/src/modules/app/design-system/"]),
			HINT,
		).toEqual([]);
	});
});
