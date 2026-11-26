import { describe, expect, it } from "vitest";
import {
	findUnusedKeys,
	flattenKeys,
	usedKeysIn,
} from "../../scripts/locale-keys.mjs";

const unused = (tree: Record<string, unknown>, source: string) =>
	findUnusedKeys(flattenKeys(tree).keys(), usedKeysIn(source));

const tree = { ns: { used: "a", rich: "b", dead: "c" } };

describe("check-translations: translator variables paired with their calls", () => {
	it("marks only the keys a translator calls, not its whole namespace", () => {
		expect(
			unused(
				tree,
				`const t = useTranslations("ns");
				 return <p>{t("used")}{t.rich("rich", { b: (c) => c })}</p>;`,
			),
		).toEqual(["ns.dead"]);
	});

	it("follows a renamed translator and getTranslations (awaited, namespace option)", () => {
		const source = `
			const tFooter = useTranslations("ns");
			tFooter("used");
			const tServer = await getTranslations({ locale, namespace: "other" });
			tServer.has("x");
			const tAsync = await getTranslations("ns");
			tAsync.raw("rich");`;
		expect(unused({ ...tree, other: { x: "1", y: "2" } }, source)).toEqual([
			"ns.dead",
			"other.y",
		]);
	});

	it("pairs each call with the nearest translator declared before it", () => {
		const source = `
			function A() { const t = useTranslations("ns"); return t("used"); }
			function B() { const t = useTranslations("other"); return t("x"); }`;
		expect(
			unused({ ns: { used: "a", x: "b" }, other: { x: "c" } }, source),
		).toEqual(["ns.x"]);
	});

	it("counts the whole namespace when the translator leaves the file or gets a dynamic key", () => {
		expect(
			unused(tree, `const t = useTranslations("ns"); return <Row t={t} />;`),
		).toEqual([]);
		expect(
			unused(tree, `const t = useTranslations("ns"); helper(t, 1);`),
		).toEqual([]);
		expect(
			unused(tree, `const t = useTranslations("ns"); return t(key);`),
		).toEqual([]);
		expect(
			unused(
				{ ns: { rows: { a: "1" }, dead: "c" } },
				// biome-ignore lint/suspicious/noTemplateCurlyInString: source text under test
				'const t = useTranslations("ns"); return t(`rows.${id}`);',
			),
		).toEqual(["ns.dead"]);
	});

	it("keeps the fallback for a translator call without a tracked variable", () => {
		// useTranslations("ns") not bound to a name (e.g. destructured) → namespace-wide.
		expect(
			unused(tree, `const [t1] = [useTranslations("ns")]; t1("used");`),
		).toEqual([]);
		// Full keys without a namespace.
		expect(
			unused(tree, `const t = useTranslations(); t("ns.used"); t("ns.rich");`),
		).toEqual(["ns.dead"]);
	});
});

describe("check-translations: a namespace-less translator handed to a helper", () => {
	it("counts the full keys the file passes along with it", () => {
		expect(
			unused(
				{ webhooks: { deleteError: "a", dead: "b" } },
				`const tRoot = useTranslations();
				 toast.error(planGateMessage(e, tRoot, "webhooks.deleteError"));`,
			),
		).toEqual(["webhooks.dead"]);
	});
});
