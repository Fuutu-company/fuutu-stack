import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: every app-owned extension file carries the app-owned header
 * and stays wired into the kit code that reads it. If a kit refactor
 * drops one of these imports, an app's customisation would silently stop
 * applying — this fails instead.
 *
 * The list lives in `fuutu.ownership.json` (repo root) — the single source
 * of truth editor tooling reads too. Every file carrying the header is
 * listed there (as an extension point or under `appOwned`), and every
 * listed file carries it; anything not listed is kit-owned.
 */

const ROOT = join(import.meta.dirname, "../../../..");
const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

const HEADER =
	"App-owned — the kit never changes this file's content after release; fill it for your app.";

/** Comment text with the `*` gutters and line breaks folded away. */
const commentText = (source: string) =>
	source
		.replace(/^\s*\*\s?/gm, "")
		.replace(/\s+/g, " ")
		.trim();

type StoredRegExp = { source: string; flags: string };
type Manifest = {
	schemaVersion: number;
	header: string;
	extensionPoints: {
		file: string;
		exports: string[];
		purpose: string;
		wiredInto: { file: string; import: StoredRegExp }[];
	}[];
	appOwned: string[];
};

const MANIFEST: Manifest = JSON.parse(read("fuutu.ownership.json"));

const EXTENSION_POINTS = MANIFEST.extensionPoints.map((point) => ({
	...point,
	wiredInto: point.wiredInto.map((target) => ({
		file: target.file,
		import: new RegExp(target.import.source, target.import.flags),
	})),
}));

/** `*` = any characters within one path segment, `**` = any segments. */
const globToRegExp = (glob: string) =>
	new RegExp(
		`^${glob
			.split("/")
			.map((seg) =>
				seg === "**"
					? "(?:[^/]+/)*"
					: `${seg
							.split("*")
							.map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
							.join("[^/]*")}/`,
			)
			.join("")
			.replace(/\/$/, "")}$`,
	);

const SCANNED = ["apps", "packages", "tooling"];
const SKIPPED = new Set([
	"node_modules",
	".next",
	".turbo",
	".source",
	"dist",
	"generated",
	"zod",
]);

/** Source files whose block comments carry the app-owned header. */
function filesWithHeader(): string[] {
	const found: string[] = [];
	const walk = (dir: string) => {
		for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
			const rel = `${dir}/${entry.name}`;
			if (entry.isDirectory()) {
				if (!SKIPPED.has(entry.name)) walk(rel);
			} else if (/\.(ts|tsx|mts|mjs|js)$/.test(entry.name)) {
				const comments = read(rel).match(/\/\*[\s\S]*?\*\//g) ?? [];
				if (comments.some((c) => commentText(c).includes(HEADER))) {
					found.push(rel);
				}
			}
		}
	};
	for (const dir of SCANNED) walk(dir);
	return found.sort();
}

describe("fuutu.ownership.json", () => {
	it("is versioned and names the app-owned header", () => {
		expect(MANIFEST.schemaVersion).toBe(1);
		expect(MANIFEST.header).toBe(HEADER);
		for (const point of MANIFEST.extensionPoints) {
			expect(point.purpose, point.file).toMatch(/\S/);
		}
	});

	it("lists every file that carries the app-owned header", () => {
		const listed = (file: string) =>
			MANIFEST.extensionPoints.some((p) => p.file === file) ||
			MANIFEST.appOwned.some((glob) => globToRegExp(glob).test(file));
		const unlisted = filesWithHeader().filter((file) => !listed(file));
		expect(
			unlisted,
			"add these to fuutu.ownership.json (extensionPoints or appOwned)",
		).toEqual([]);
	});

	it("every listed file carries the app-owned header", () => {
		const withHeader = filesWithHeader();
		for (const glob of MANIFEST.appOwned) {
			const re = globToRegExp(glob);
			const matches = withHeader.filter((file) => re.test(file));
			expect(matches.length, glob).toBeGreaterThan(0);
		}
		for (const point of MANIFEST.extensionPoints) {
			expect(withHeader, point.file).toContain(point.file);
		}
	});

	it("appOwned globs: * stays in one path segment, ** spans segments", () => {
		expect(
			globToRegExp("packages/i18n/translations/*/app/index.ts").test(
				"packages/i18n/translations/de/app/index.ts",
			),
		).toBe(true);
		expect(
			globToRegExp("packages/*/index.ts").test("packages/a/b/index.ts"),
		).toBe(false);
		expect(
			globToRegExp("packages/**/index.ts").test("packages/a/b/index.ts"),
		).toBe(true);
	});
});

describe("app-owned extension points", () => {
	for (const point of EXTENSION_POINTS) {
		describe(point.file, () => {
			const source = read(point.file);

			it("carries the app-owned header", () => {
				expect(commentText(source)).toContain(HEADER);
			});

			it("exports its extension values", () => {
				for (const name of point.exports) {
					expect(source, name).toMatch(
						new RegExp(
							`^export (const|async function|function) ${name}\\b`,
							"m",
						),
					);
				}
			});

			for (const target of point.wiredInto) {
				it(`is read by ${target.file}`, () => {
					expect(read(target.file)).toMatch(target.import);
				});
			}
		});
	}

	it("names every app-owned file app-<topic> and every export app<Name>", () => {
		for (const point of EXTENSION_POINTS) {
			const base = point.file.split("/").at(-1) ?? "";
			if (base !== "server-init.ts") {
				expect(base, point.file).toMatch(/^app-[a-z-]+(\.server)?\.tsx?$/);
			}
			for (const name of point.exports) {
				if (name === "registerApp") continue;
				expect(name, point.file).toMatch(/^app[A-Z]/);
			}
		}
	});

	it("registerApp runs only in the nodejs runtime, after the kit boot steps", () => {
		const source = read("apps/saas/src/instrumentation.ts");
		const gate = source.indexOf('process.env.NEXT_RUNTIME !== "nodejs"');
		const provider = source.indexOf(
			"setPaymentProvider(env.PAYMENTS_PROVIDER)",
		);
		const call = source.indexOf("await registerApp()");
		expect(gate).toBeGreaterThan(-1);
		expect(call).toBeGreaterThan(provider);
		expect(provider).toBeGreaterThan(gate);
	});
});
