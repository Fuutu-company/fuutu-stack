#!/usr/bin/env node
/**
 * Translation completeness checker.
 *
 * 1. Verifies every locale dir under translations/ contains every key.
 * 2. Warns about keys in translation files that are never referenced in source code.
 * 3. Cross-checks FEATURE_CATALOG IDs against payments.features translation keys.
 * 4. Cross-checks CREDIT_METERS keys + CREDIT_TOPUPS ids against credits.* keys
 *    (and warns about stale credits.meters/credits.topup.packages keys).
 *
 * Run: node packages/i18n/scripts/check-translations.mjs
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const translationsDir = resolve(__dirname, "../translations");

let hasErrors = false;

// ─── Collect and flatten translation keys ────────────────────────────────────

/** Normalize path separators so endsWith() checks work on Windows too. */
function toPosixPath(p) {
	return p.split(sep).join("/");
}

function collectJsonFiles(dir) {
	const results = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			results.push(...collectJsonFiles(full));
		} else if (entry.endsWith(".json")) {
			results.push(full);
		}
	}
	return results;
}

function flattenKeys(obj, prefix = "") {
	const keys = new Map();
	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key;
		if (value !== null && typeof value === "object" && !Array.isArray(value)) {
			const nested = flattenKeys(value, fullKey);
			for (const [k, v] of nested) keys.set(k, v);
		} else {
			keys.set(
				fullKey,
				typeof value === "string" ? value : JSON.stringify(value),
			);
		}
	}
	return keys;
}

function loadLocaleKeys(locale) {
	const localeDir = join(translationsDir, locale);
	const files = collectJsonFiles(localeDir);
	const merged = new Map();
	for (const file of files) {
		const content = JSON.parse(readFileSync(file, "utf-8"));
		const flat = flattenKeys(content);
		for (const [k, v] of flat) merged.set(k, v);
	}
	return merged;
}

// ─── Scan source files for translation key usage ──────────────────────────────

const SKIP_DIRS = new Set([
	"node_modules",
	".next",
	"dist",
	".turbo",
	"coverage",
	"out",
]);

function scanTsFiles(dir) {
	const files = [];
	try {
		for (const entry of readdirSync(dir)) {
			if (SKIP_DIRS.has(entry)) continue;
			const full = join(dir, entry);
			if (statSync(full).isDirectory()) {
				files.push(...scanTsFiles(full));
			} else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
				files.push(full);
			}
		}
	} catch {
		// dir doesn't exist
	}
	return files;
}

function collectSourceDirs() {
	const dirs = [];
	for (const base of ["apps", "packages"]) {
		const baseDir = join(repoRoot, base);
		for (const entry of readdirSync(baseDir)) {
			// i18n itself defines the keys — its own sources don't count as usage
			if (base === "packages" && entry === "i18n") continue;
			const srcDir = join(baseDir, entry, "src");
			try {
				if (statSync(srcDir).isDirectory()) dirs.push(srcDir);
			} catch {
				// no src dir
			}
		}
	}
	return dirs;
}

function extractUsedKeys() {
	const keys = new Set();
	const sourceDirs = collectSourceDirs();
	const patterns = [
		// Static: t("key"), t('key'), t(`key`) — plus t.has()/t.raw()/t.rich()
		/\bt(?:\.(?:has|raw|rich))?\(["'`]([^"'`]+)["'`]/g,
		/\bgetTranslations\(["'`]([^"'`]+)["'`]\)/g,
		/\bgetTranslations\(\{[^}]*namespace:\s*["'`]([^"'`]+)["'`]/g,
		/\buseTranslations\(["'`]([^"'`]+)["'`]\)/g,
		// Template literals: t(`prefix.${var}`) → extract "prefix" as a used
		// namespace. Fully dynamic keys (e.g. t.has(`source.${e}`) for
		// credits.source.*) can only be resolved to their prefix — the leaf
		// is unknowable statically, so unused-key stays warn-only.
		/\bt(?:\.(?:has|raw|rich))?\(`([^`${}]+)\.\$\{[^}]+\}`/g,
		// Property access: messages.cron.subscriptionReminder.title, messages.nav.docs
		/\bmessages\.([a-zA-Z0-9_.]+)/g,
		// labelKey: "key" pattern in footer/navbar
		/\blabelKey:\s*["'`]([^"'`]+)["'`]/g,
	];
	for (const dir of sourceDirs) {
		const files = scanTsFiles(dir);
		for (const file of files) {
			const content = readFileSync(file, "utf-8");
			for (const pattern of patterns) {
				let match = pattern.exec(content);
				while (match !== null) {
					keys.add(match[1]);
					match = pattern.exec(content);
				}
			}
		}
	}
	return keys;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const locales = readdirSync(translationsDir)
	.filter(
		(entry) =>
			!entry.startsWith(".") &&
			statSync(join(translationsDir, entry)).isDirectory(),
	)
	.sort();
const localeKeys = new Map(locales.map((l) => [l, loadLocaleKeys(l)]));

// Union of all keys across locales — every locale must contain every key.
const allKnownKeys = new Set();
for (const keys of localeKeys.values()) {
	for (const k of keys.keys()) allKnownKeys.add(k);
}

// 1. Check every locale has all keys
for (const [locale, keys] of localeKeys) {
	const missing = [...allKnownKeys].filter((k) => !keys.has(k));
	if (missing.length > 0) {
		hasErrors = true;
		console.error(`\n❌ Missing in ${locale}/ (${missing.length} keys):`);
		for (const k of missing.sort()) console.error(`   - ${k}`);
	}
}

// 2. Check for unused keys
const usedKeys = extractUsedKeys();
const allKeys = allKnownKeys;
const unused = [];
for (const key of allKeys) {
	const parts = key.split(".");
	let found = false;
	for (let i = parts.length; i >= 1; i--) {
		const candidate = parts.slice(0, i).join(".");
		if (usedKeys.has(candidate)) {
			found = true;
			break;
		}
	}
	if (!found) unused.push(key);
}

if (unused.length > 0) {
	console.warn(`\n⚠️  Potentially unused translation keys (${unused.length}):`);
	for (const k of unused.sort()) console.warn(`   - ${k}`);
}

// ─── 3. Cross-check FEATURE_CATALOG against translations ─────────────────────

function extractFeatureCatalog(source) {
	const catalog = {};
	const groupRegex = /^\s*(\w+)\s*:\s*\{([\s\S]*?)\n\s*\},\s*$/gm;
	let groupMatch = groupRegex.exec(source);
	while (groupMatch !== null) {
		const groupName = groupMatch[1];
		const groupBody = groupMatch[2];
		const keys = [];
		const keyRegex = /^\s*(\w+)\s*:\s*\{/gm;
		let keyMatch = keyRegex.exec(groupBody);
		while (keyMatch !== null) {
			keys.push(keyMatch[1]);
			keyMatch = keyRegex.exec(groupBody);
		}
		catalog[groupName] = keys;
		groupMatch = groupRegex.exec(source);
	}
	return catalog;
}

const configPath = join(repoRoot, "packages/payments/src/config.ts");
const featureErrors = [];
let configSrc = null;
try {
	configSrc = readFileSync(configPath, "utf-8");
} catch (err) {
	featureErrors.push(
		`Could not read ${configPath}: ${err instanceof Error ? err.message : err}`,
	);
}
const catalogMatch =
	configSrc?.match(
		/export const FEATURE_CATALOG\s*=\s*(\{[\s\S]*?\})\s*as const/,
	) ?? null;

if (configSrc !== null && !catalogMatch) {
	featureErrors.push("Could not extract FEATURE_CATALOG from config.ts");
} else if (catalogMatch) {
	const catalog = extractFeatureCatalog(catalogMatch[1]);
	const groups = Object.keys(catalog);
	const featureIds = [];
	for (const [group, keys] of Object.entries(catalog)) {
		for (const key of keys) {
			featureIds.push(`${group}_${key}`);
		}
	}

	for (const locale of locales) {
		const localeDir = join(translationsDir, locale);
		const paymentsFile = collectJsonFiles(localeDir).find((f) =>
			toPosixPath(f).endsWith("common/payments.json"),
		);
		if (!paymentsFile) {
			featureErrors.push(`[${locale}] Missing common/payments.json`);
			continue;
		}
		const payments = JSON.parse(readFileSync(paymentsFile, "utf-8"));
		const features = payments.payments?.features;
		const plans = payments.payments?.plans;
		if (!features) {
			featureErrors.push(`[${locale}] Missing payments.features section`);
			continue;
		}

		// 3a. Group labels
		for (const group of groups) {
			if (!features.groups?.[group]) {
				featureErrors.push(
					`[${locale}] Missing group label: payments.features.groups.${group}`,
				);
			}
		}

		// 3b. Feature labels
		for (const [group, keys] of Object.entries(catalog)) {
			const section = features[group];
			if (!section || typeof section !== "object") {
				featureErrors.push(
					`[${locale}] Missing feature section: payments.features.${group}`,
				);
				continue;
			}
			for (const key of keys) {
				if (!section[key]) {
					featureErrors.push(
						`[${locale}] Missing feature label: payments.features.${group}.${key}`,
					);
				}
			}
		}

		// 3c. Plan featureLabels reference real feature IDs
		if (plans) {
			for (const [planId, plan] of Object.entries(plans)) {
				const labels = plan.featureLabels;
				if (!labels) continue;
				for (const featureId of Object.keys(labels)) {
					if (!featureIds.includes(featureId)) {
						featureErrors.push(
							`[${locale}] Plan "${planId}" featureLabels has unknown key: "${featureId}" (not in FEATURE_CATALOG)`,
						);
					}
				}
			}
		}

		// 3d. No unknown sections
		const knownSections = new Set([...groups, "groups", "tooltips"]);
		for (const section of Object.keys(features)) {
			if (!knownSections.has(section)) {
				featureErrors.push(
					`[${locale}] Unknown section in payments.features: "${section}" (not in FEATURE_CATALOG groups: ${groups.join(", ")})`,
				);
			}
		}
	}
}

if (featureErrors.length > 0) {
	hasErrors = true;
	console.error(
		`\n❌ Feature↔Translation cross-check (${featureErrors.length} errors):`,
	);
	for (const e of featureErrors) console.error(`   - ${e}`);
} else {
	console.log("\n✅ Feature translations match FEATURE_CATALOG.");
}

// ─── 4. Cross-check CREDIT_METERS + CREDIT_TOPUPS against translations ────────

/** Remove `//` line and `/* … *\/` block comments (used for emptiness checks). */
function stripComments(s) {
	return s.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
}

/**
 * Extract the top-level elements of the `[...]` array literal in
 * `export const NAME: T[] = [...]` as source strings.
 *
 * Scans bracket depth while skipping string literals ('…' "…" `…`,
 * honoring `\` escapes) and comments (//, /* *\/) so brackets and commas
 * inside them don't corrupt the split. A focused helper, not a TS parser.
 *
 * Returns the element list ([] for an empty array), or null if not found.
 */
function extractArrayElements(source, exportName) {
	const match = source.match(
		new RegExp(`export\\s+const\\s+${exportName}\\b[^=]*=\\s*\\[`),
	);
	if (!match) return null;

	const start = match.index + match[0].length - 1; // index of "["
	const elements = [];
	let depth = 0;
	let state = null; // "'" | '"' | "`" | "line-comment" | "block-comment"
	let elemStart = start + 1;
	let end = -1;

	for (let i = start; i < source.length; i++) {
		const ch = source[i];
		const next = source[i + 1];

		if (state === "line-comment") {
			if (ch === "\n") state = null;
			continue;
		}
		if (state === "block-comment") {
			if (ch === "*" && next === "/") {
				state = null;
				i++;
			}
			continue;
		}
		if (state !== null) {
			// Inside a string literal — '\' escapes the next character.
			if (ch === "\\") i++;
			else if (ch === state) state = null;
			continue;
		}

		if (ch === "'" || ch === '"' || ch === "`") {
			state = ch;
		} else if (ch === "/" && next === "/") {
			state = "line-comment";
			i++;
		} else if (ch === "/" && next === "*") {
			state = "block-comment";
			i++;
		} else if (ch === "[" || ch === "{" || ch === "(") {
			depth++;
		} else if (ch === "]" || ch === "}" || ch === ")") {
			depth--;
			if (depth === 0) {
				end = i;
				break;
			}
		} else if (ch === "," && depth === 1) {
			const elem = source.slice(elemStart, i);
			if (stripComments(elem).trim() !== "") elements.push(elem);
			elemStart = i + 1;
		}
	}
	if (end === -1) return null;

	const tail = source.slice(elemStart, end);
	if (stripComments(tail).trim() !== "") elements.push(tail);
	return elements;
}

/**
 * Extract `field: "…"` values from extracted array elements.
 * Distinguishes three states: array not found (error), empty array
 * (legit — nothing to check), and elements lacking the field (error —
 * format drift the regex can't parse, must not silently pass).
 */
function extractFieldValues(elements, field, exportName, filePath) {
	if (elements === null) {
		return { error: `Could not extract ${exportName} from ${filePath}` };
	}
	if (elements.length === 0) {
		return { keys: [], empty: true };
	}
	const fieldRe = new RegExp(`\\b${field}:\\s*"([^"]+)"`);
	const keys = [];
	for (let i = 0; i < elements.length; i++) {
		const m = elements[i].match(fieldRe);
		if (!m) {
			return {
				error: `${exportName}[${i}] in ${filePath} has no ${field}: "…" property — format drift?`,
			};
		}
		keys.push(m[1]);
	}
	return { keys };
}

const creditErrors = [];
const creditNotes = [];
const creditWarnings = [];

const metersPath = join(repoRoot, "packages/credits/src/meters.ts");
let meterKeys = null;
try {
	const result = extractFieldValues(
		extractArrayElements(readFileSync(metersPath, "utf-8"), "CREDIT_METERS"),
		"key",
		"CREDIT_METERS",
		"packages/credits/src/meters.ts",
	);
	if (result.error) {
		creditErrors.push(result.error);
	} else {
		meterKeys = result.keys;
		if (result.empty) {
			creditNotes.push("CREDIT_METERS is empty — no meter labels to check");
		}
	}
} catch (err) {
	creditErrors.push(
		`Could not read ${metersPath}: ${err instanceof Error ? err.message : err}`,
	);
}

let topupIds = null;
if (configSrc !== null) {
	const result = extractFieldValues(
		extractArrayElements(configSrc, "CREDIT_TOPUPS"),
		"id",
		"CREDIT_TOPUPS",
		"packages/payments/src/config.ts",
	);
	if (result.error) {
		creditErrors.push(result.error);
	} else {
		topupIds = result.keys;
		if (result.empty) {
			creditNotes.push(
				"CREDIT_TOPUPS is empty — no top-up package labels to check",
			);
		}
	}
}

if (meterKeys !== null || topupIds !== null) {
	for (const locale of locales) {
		const localeDir = join(translationsDir, locale);
		const creditsFile = collectJsonFiles(localeDir).find((f) =>
			toPosixPath(f).endsWith("saas/credits.json"),
		);
		if (!creditsFile) {
			creditErrors.push(`[${locale}] Missing saas/credits.json`);
			continue;
		}
		const credits = JSON.parse(readFileSync(creditsFile, "utf-8")).credits;
		if (!credits || typeof credits !== "object") {
			creditErrors.push(`[${locale}] Missing credits section`);
			continue;
		}

		// 4a. Every configured meter has a label
		for (const key of meterKeys ?? []) {
			if (typeof credits.meters?.[key] !== "string") {
				creditErrors.push(
					`[${locale}] Missing meter label: credits.meters.${key}`,
				);
			}
		}

		// 4b. Every configured top-up package has label and description
		for (const id of topupIds ?? []) {
			for (const field of ["label", "description"]) {
				if (typeof credits.topup?.packages?.[id]?.[field] !== "string") {
					creditErrors.push(
						`[${locale}] Missing top-up ${field}: credits.topup.packages.${id}.${field}`,
					);
				}
			}
		}

		// 4c. Warn about stale keys: translations for meters/top-ups that
		// no longer exist in config (leftovers after removing an entry).
		if (meterKeys !== null) {
			for (const key of Object.keys(credits.meters ?? {})) {
				if (!meterKeys.includes(key)) {
					creditWarnings.push(
						`[${locale}] Stale meter label: credits.meters.${key} (not in CREDIT_METERS)`,
					);
				}
			}
		}
		if (topupIds !== null) {
			for (const id of Object.keys(credits.topup?.packages ?? {})) {
				if (!topupIds.includes(id)) {
					creditWarnings.push(
						`[${locale}] Stale top-up labels: credits.topup.packages.${id} (not in CREDIT_TOPUPS)`,
					);
				}
			}
		}
	}
}

if (creditErrors.length > 0) {
	hasErrors = true;
	console.error(
		`\n❌ Credits↔Translation cross-check (${creditErrors.length} errors):`,
	);
	for (const e of creditErrors) console.error(`   - ${e}`);
} else {
	console.log("\n✅ Credit translations match CREDIT_METERS + CREDIT_TOPUPS.");
}

for (const n of creditNotes) console.log(`ℹ️  ${n}`);

if (creditWarnings.length > 0) {
	console.warn(
		`\n⚠️  Stale credit translation keys (${creditWarnings.length}):`,
	);
	for (const w of creditWarnings) console.warn(`   - ${w}`);
}

// Summary
const totalKeys = allKnownKeys.size;

console.log("\n📊 Translation summary:");
for (const [locale, keys] of localeKeys) {
	const coverage =
		totalKeys > 0 ? Math.floor((keys.size / totalKeys) * 100) : 100;
	console.log(
		`   ${locale.toUpperCase()} keys: ${keys.size} (${coverage}% coverage)`,
	);
}
console.log(`   Unused keys: ${unused.length}`);

if (hasErrors) {
	console.error("\n❌ Translation check failed!");
	process.exit(1);
} else {
	console.log("\n✅ All translation keys are present in all locales.");
	if (unused.length > 0) {
		console.log("⚠️  Unused keys detected — consider removing them.");
	}
	process.exit(0);
}
