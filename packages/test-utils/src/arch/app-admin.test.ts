import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * App-owned admin detail tabs (`apps/saas/src/app-admin.tsx`): an app
 * section key must never collide with a kit tab or another app section —
 * the detail pages throw on render, this catches it in CI first.
 */

const { KIT_ORGANIZATION_TAB_KEYS, KIT_USER_TAB_KEYS, resolveAdminSections } =
	await import("../../../../apps/saas/src/modules/app/admin/admin-sections");

const Component = () => null;
const SRC = join(import.meta.dirname, "../../../../apps/saas/src");

describe("resolveAdminSections", () => {
	it("returns the app sections untouched when keys are unique", () => {
		const sections = [
			{ key: "tickets", titleKey: "tickets", Component },
			{ key: "notes", titleKey: "notes", Component },
		];
		expect(resolveAdminSections(KIT_USER_TAB_KEYS, sections)).toEqual(sections);
	});

	it("throws on a key a kit tab already uses", () => {
		for (const key of ["overview", "billing", "activity"]) {
			expect(() =>
				resolveAdminSections(KIT_USER_TAB_KEYS, [
					{ key, titleKey: "x", Component },
				]),
			).toThrow(new RegExp(`duplicate key "${key}"`));
		}
		expect(() =>
			resolveAdminSections(KIT_ORGANIZATION_TAB_KEYS, [
				{ key: "members", titleKey: "x", Component },
			]),
		).toThrow(/duplicate key "members"/);
	});

	it("throws on two app sections with one key", () => {
		expect(() =>
			resolveAdminSections(KIT_USER_TAB_KEYS, [
				{ key: "tickets", titleKey: "a", Component },
				{ key: "tickets", titleKey: "b", Component },
			]),
		).toThrow(/duplicate key "tickets"/);
	});
});

describe("the shipped app lists (apps/saas/src/app-admin.tsx)", () => {
	// Read as source: the file is .tsx and holds components, so the keys are
	// taken from its `key: "…"` entries, split by the list they belong to.
	const source = readFileSync(join(SRC, "app-admin.tsx"), "utf8");
	const keysOf = (list: string) => {
		const body = source.split(`export const ${list}`)[1]?.split("export ")[0];
		return [...(body ?? "").matchAll(/^\s*\{?\s*key: "(\w+)"/gm)].map((m) => ({
			key: m[1] ?? "",
		}));
	};

	it("appAdminUserSections renders next to the kit user tabs", () => {
		expect(() =>
			resolveAdminSections(KIT_USER_TAB_KEYS, keysOf("appAdminUserSections")),
		).not.toThrow();
	});

	it("appAdminOrganizationSections renders next to the kit organization tabs", () => {
		expect(() =>
			resolveAdminSections(
				KIT_ORGANIZATION_TAB_KEYS,
				keysOf("appAdminOrganizationSections"),
			),
		).not.toThrow();
	});

	it("kit tab keys match the tabs the detail pages render", () => {
		const tabs = (file: string) =>
			[
				...readFileSync(join(SRC, file), "utf8").matchAll(
					/<TabsTrigger value="(\w+)"/g,
				),
			].map((m) => m[1]);
		expect(tabs("modules/app/admin/user-detail/admin-user-detail.tsx")).toEqual(
			[...KIT_USER_TAB_KEYS],
		);
		expect(
			tabs("modules/app/admin/org-detail/admin-organization-detail.tsx"),
		).toEqual([...KIT_ORGANIZATION_TAB_KEYS]);
	});
});
