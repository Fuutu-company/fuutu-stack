import { describe, expect, it } from "vitest";
import {
	findUnusedKeys,
	flattenKeys,
	loadLocaleKeys,
	usedKeysIn,
} from "../../scripts/locale-keys.mjs";

describe("check-translations key paths (the merged runtime tree)", () => {
	it("counts a key mounted under a nested namespace as used", () => {
		// translations/<locale>/desktop/index.ts mounts x.json as `desktop: { x }`.
		const keys = flattenKeys({ desktop: { x: { k: "Hello" } } });
		expect([...keys.keys()]).toEqual(["desktop.x.k"]);
		const used = usedKeysIn(
			'const t = useTranslations("desktop.x");\nreturn t("k");',
		);
		expect(findUnusedKeys(keys.keys(), used)).toEqual([]);
	});

	it("still reports a key nothing references", () => {
		const keys = flattenKeys({ desktop: { x: { k: "a", stale: "b" } } });
		const used = usedKeysIn('useTranslations("desktop.y"); t("k");');
		expect(findUnusedKeys(keys.keys(), used)).toEqual([
			"desktop.x.k",
			"desktop.x.stale",
		]);
	});

	it("reads the keys where index.ts mounts them, app overlay included", async () => {
		const { keys, appKeys } = await loadLocaleKeys("en");
		expect(keys.has("desktop.about.title")).toBe(true);
		expect(keys.has("title")).toBe(false);
		// The full tree nests docs (mail, cron); the docs app reads `home.*`.
		expect(keys.has("docs.home.title")).toBe(true);
		expect(appKeys.has("home.title")).toBe(true);
		expect(appKeys.has("docs.home.title")).toBe(false);
	});
});
