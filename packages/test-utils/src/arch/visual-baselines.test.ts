import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { i18nConfig } from "../../../i18n/config";

/**
 * Orphaned visual baselines: a committed PNG that no visual spec writes any
 * more (page or test removed, locale disabled, a viewport the project no
 * longer shoots). Playwright never deletes snapshots, so these linger and
 * look like current renders. This guard catches the ones the file name
 * gives away; the CI baseline update and `pnpm test:visual:local --update`
 * delete exactly those (visual-prune.mjs, same rules). A shot whose test
 * skips itself (feature off, other project class) is not visible by name —
 * delete its baseline with the change that skips it.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const APPS = ["saas", "marketing"] as const;
const LOCALES = Object.keys(i18nConfig.locales);

// Same parser and rules as tooling/scripts/visual-prune.mjs — what this
// guard rejects is exactly what the CI and local update runs delete.
const lib = await import("../../../../tooling/scripts/visual-local-lib.mjs");
const parse = lib.parseBaseline;

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
	const ctx = { locales: LOCALES, specSource: specSource(app) };
	const orphans = (...reasons: string[]) =>
		files.filter((f) => reasons.includes(lib.orphanReason(f, ctx) ?? ""));

	it("has no baseline for a disabled locale", () => {
		expect(orphans("disabled locale")).toEqual([]);
	});

	it("has no baseline whose page no visual spec names", () => {
		expect(
			orphans("unknown project", "no visual spec names this page"),
		).toEqual([]);
	});

	it("shoots each viewport on one project class only (mobile on mobile projects)", () => {
		expect(orphans("viewport shot on the wrong project class")).toEqual([]);
	});
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
