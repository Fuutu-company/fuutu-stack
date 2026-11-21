import { House } from "lucide-react";
import { describe, expect, it } from "vitest";
import { type AppNavItem, buildNav, isNavActive } from "../nav";

const item = (
	titleKey: string,
	extra: Partial<AppNavItem> | Record<string, unknown> = {},
): AppNavItem =>
	({
		titleKey,
		href: `/${titleKey}/`,
		icon: House,
		...extra,
	}) as AppNavItem;

describe("desktop nav (app-nav.ts → buildNav)", () => {
	it("is the kit nav without app items", () => {
		expect(buildNav([]).map((i) => i.titleKey)).toEqual([
			"home",
			"settings",
			"account",
		]);
	});

	it("appends app items, or places them after a kit item", () => {
		const nav = buildNav([
			item("projects", { after: "home" }),
			item("reports"),
		]);
		expect(nav.map((i) => i.titleKey)).toEqual([
			"home",
			"projects",
			"settings",
			"account",
			"reports",
		]);
	});

	it("refuses a duplicate key or a href outside the app", () => {
		expect(() => buildNav([item("settings")])).toThrow(/duplicate/);
		expect(() => buildNav([item("a"), item("a")])).toThrow(/duplicate/);
		expect(() =>
			buildNav([item("x", { href: "https://example.com/" })]),
		).toThrow(/href/);
	});

	it("marks app items active on their subpaths unless exact", () => {
		const [projects] = buildNav([item("projects")]).slice(-1);
		expect(projects && isNavActive("/projects/42/", projects)).toBe(true);
		const exact = { ...item("x"), exact: true };
		expect(isNavActive("/x/1/", exact)).toBe(false);
		expect(isNavActive("/x/", exact)).toBe(true);
		const [home] = buildNav([]);
		expect(home && isNavActive("/settings/", home)).toBe(false);
	});
});
