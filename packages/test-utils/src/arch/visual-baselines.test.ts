import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { i18nConfig } from "../../../i18n/config";

/**
 * Orphaned visual baselines: a committed PNG that no visual spec writes any
 * more (page or test removed, locale disabled, a viewport the project no
 * longer shoots). Playwright never deletes snapshots, so these linger and
 * look like current renders. `pnpm test:visual:local --update` and the CI
 * baseline update prune the ones only a run can tell; this guard catches the
 * ones the file name already gives away.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const APPS = ["saas", "marketing"] as const;
const LOCALES = Object.keys(i18nConfig.locales);
const VIEWPORTS = ["desktop", "tablet", "mobile"];
// Longest first: `mobile-safari` before `safari`-like prefixes.
const PROJECTS = [
	"mobile-safari",
	"mobile-chrome",
	"chromium",
	"firefox",
	"webkit",
];

interface Parsed {
	/** `category--slug`, without locale, viewport, project and platform. */
	base: string;
	project: string;
	locale: string | null;
	viewport: string | null;
}

function parse(file: string): Parsed | null {
	const stem = file.replace(/-linux\.png$/, "");
	const project = PROJECTS.find((p) => stem.endsWith(`-${p}`));
	if (!project) return null;
	const tokens = stem.slice(0, -(project.length + 1)).split("-");
	const viewport = VIEWPORTS.includes(tokens.at(-1) ?? "")
		? tokens.pop()
		: null;
	// A locale token only counts in front of a viewport (`…-en-desktop`);
	// no locale-less name carries one.
	const locale =
		viewport !== null && tokens.at(-1)?.length === 2
			? (tokens.pop() ?? null)
			: null;
	return {
		base: tokens.join("-"),
		project,
		locale,
		viewport: viewport ?? null,
	};
}

const specSource = (app: string) => {
	const dir = join(REPO_ROOT, "apps", app, "tests");
	return readdirSync(dir)
		.filter((f) => f.endsWith(".ts"))
		.map((f) => readFileSync(join(dir, f), "utf8"))
		.join("\n");
};

describe.each(APPS)("visual baselines of %s", (app) => {
	const dir = join(REPO_ROOT, ".fuutu", "visual-baselines", app);
	const files = existsSync(dir)
		? readdirSync(dir).filter((f) => f.endsWith("-linux.png"))
		: [];
	const source = specSource(app);

	it("has no baseline for a disabled locale", () => {
		const orphans = files.filter((f) => {
			const locale = parse(f)?.locale;
			return locale && !LOCALES.includes(locale);
		});
		expect(orphans).toEqual([]);
	});

	it("has no baseline whose page no visual spec names", () => {
		const orphans = files.filter((f) => {
			const parsed = parse(f);
			return !parsed || !source.includes(`"${parsed.base}`);
		});
		expect(orphans).toEqual([]);
	});

	if (app === "marketing") {
		it("shoots each viewport on one project class only (mobile on mobile projects)", () => {
			const orphans = files.filter((f) => {
				const parsed = parse(f);
				if (!parsed?.viewport) return false;
				const mobileProject = parsed.project.startsWith("mobile-");
				return (parsed.viewport === "mobile") !== mobileProject;
			});
			expect(orphans).toEqual([]);
		});
	}
});

describe("orphan guard", () => {
	it("reads locale, viewport and project from a baseline name", () => {
		expect(parse("marketing--blog-en-tablet-chromium-linux.png")).toEqual({
			base: "marketing--blog",
			project: "chromium",
			locale: "en",
			viewport: "tablet",
		});
		expect(parse("component--mobile-nav-mobile-safari-linux.png")).toEqual({
			base: "component--mobile-nav",
			project: "mobile-safari",
			locale: null,
			viewport: null,
		});
		expect(parse("admin--audit-logs-chromium-linux.png")?.locale).toBeNull();
	});
});
