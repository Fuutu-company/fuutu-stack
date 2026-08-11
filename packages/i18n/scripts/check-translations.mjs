#!/usr/bin/env node
/**
 * Translation completeness checker.
 *
 * 1. Verifies every key in en/ exists in de/ and vice versa.
 * 2. Warns about keys in translation files that are never referenced in source code.
 * 3. Cross-checks FEATURE_CATALOG IDs against payments.features translation keys.
 *
 * Run: node packages/i18n/scripts/check-translations.mjs
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const translationsDir = resolve(__dirname, "../translations");

let hasErrors = false;

// ─── Collect and flatten translation keys ────────────────────────────────────

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

function scanTsFiles(dir) {
	const files = [];
	try {
		for (const entry of readdirSync(dir)) {
			if (entry === "node_modules" || entry === ".next" || entry === "dist")
				continue;
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

function extractUsedKeys() {
	const keys = new Set();
	const sourceDirs = [
		join(repoRoot, "apps/marketing/src"),
		join(repoRoot, "apps/saas/src"),
		join(repoRoot, "packages/ui/src"),
		join(repoRoot, "packages/analytics/src"),
	];
	const patterns = [
		// Static: t("key"), t('key'), t(`key`)
		/\bt\(["'`]([^"'`]+)["'`]/g,
		/\bgetTranslations\(["'`]([^"'`]+)["'`]\)/g,
		/\bgetTranslations\(\{[^}]*namespace:\s*["'`]([^"'`]+)["'`]/g,
		/\buseTranslations\(["'`]([^"'`]+)["'`]\)/g,
		// Template literals: t(`prefix.${var}`) → extract "prefix" as a used namespace
		/\bt\(`([^`${}]+)\.\$\{[^}]+\}`/g,
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

const enKeys = loadLocaleKeys("en");
const deKeys = loadLocaleKeys("de");

// 1. Check de has all en keys
const missingInDe = [...enKeys.keys()].filter((k) => !deKeys.has(k));
if (missingInDe.length > 0) {
	hasErrors = true;
	console.error(`\n❌ Missing in de/ (${missingInDe.length} keys):`);
	for (const k of missingInDe.sort()) console.error(`   - ${k}`);
}

// 2. Check en has all de keys
const missingInEn = [...deKeys.keys()].filter((k) => !enKeys.has(k));
if (missingInEn.length > 0) {
	hasErrors = true;
	console.error(`\n❌ Missing in en/ (${missingInEn.length} keys):`);
	for (const k of missingInEn.sort()) console.error(`   - ${k}`);
}

// 3. Check for unused keys
const usedKeys = extractUsedKeys();
const allKeys = new Set([...enKeys.keys()]);
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

// ─── 4. Cross-check FEATURE_CATALOG against translations ─────────────────────

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
const configSrc = readFileSync(configPath, "utf-8");
const catalogMatch = configSrc.match(
	/export const FEATURE_CATALOG\s*=\s*(\{[\s\S]*?\})\s*as const/,
);
const featureErrors = [];

if (!catalogMatch) {
	featureErrors.push("Could not extract FEATURE_CATALOG from config.ts");
} else {
	const catalog = extractFeatureCatalog(catalogMatch[1]);
	const groups = Object.keys(catalog);
	const featureIds = [];
	for (const [group, keys] of Object.entries(catalog)) {
		for (const key of keys) {
			featureIds.push(`${group}_${key}`);
		}
	}

	for (const locale of ["en", "de"]) {
		const localeDir = join(translationsDir, locale);
		const paymentsFile = collectJsonFiles(localeDir).find((f) =>
			f.endsWith("common/payments.json"),
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

		// 4a. Group labels
		for (const group of groups) {
			if (!features.groups?.[group]) {
				featureErrors.push(
					`[${locale}] Missing group label: payments.features.groups.${group}`,
				);
			}
		}

		// 4b. Feature labels
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

		// 4c. Plan featureLabels reference real feature IDs
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

		// 4d. No unknown sections
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

// Summary
const totalKeys = enKeys.size;
const translatedKeys = deKeys.size;
const coverage =
	totalKeys > 0 ? Math.round((translatedKeys / totalKeys) * 100) : 100;

console.log("\n📊 Translation summary:");
console.log(`   EN keys: ${totalKeys}`);
console.log(`   DE keys: ${translatedKeys}`);
console.log(`   Coverage: ${coverage}%`);
console.log(`   Unused keys: ${unused.length}`);

if (hasErrors) {
	console.error("\n❌ Translation check failed!");
	process.exit(1);
} else {
	console.log("\n✅ All translation keys are present in both locales.");
	if (unused.length > 0) {
		console.log("⚠️  Unused keys detected — consider removing them.");
	}
	process.exit(0);
}
