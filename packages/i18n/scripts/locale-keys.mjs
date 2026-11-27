/**
 * Key paths for `check-translations.mjs`, taken from the message tree the
 * apps load at runtime (`importLocale` in lib/messages.ts: every bundle's
 * `translations/<locale>/…/index.ts`, where it is mounted, plus the
 * app overlay `app/index.ts`) — not from the raw JSON files, whose own
 * paths miss the namespace an index.ts mounts them under
 * (`desktop/about.json` → `desktop.about.*`).
 */

/** Flat `a.b.c` → value map of a message tree. */
export function flattenKeys(obj, prefix = "") {
	const keys = new Map();
	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key;
		if (value !== null && typeof value === "object" && !Array.isArray(value)) {
			for (const [k, v] of flattenKeys(value, fullKey)) keys.set(k, v);
		} else {
			keys.set(
				fullKey,
				typeof value === "string" ? value : JSON.stringify(value),
			);
		}
	}
	return keys;
}

/** The app views `importLocale(locale, app)` loads (what `t()` resolves against). */
export const APP_VIEWS = ["marketing", "saas", "docs", "desktop"];

/**
 * Keys of `locale` as the code sees them. `keys`: every key of the full
 * tree (`importLocale(locale)`: docs and desktop nested, as mail and cron
 * read it) and of each app view (docs keys at the top level, as the docs
 * app reads them) — for the missing-key check. `appKeys`: the app views
 * only — for the unused check, so `docs.home.*` of the full tree is not
 * reported while the docs app uses it as `home.*`.
 */
export async function loadLocaleKeys(locale) {
	const { tsImport } = await import("tsx/esm/api");
	const { importLocale } = await tsImport(
		"../lib/messages.ts",
		import.meta.url,
	);
	const keys = flattenKeys(await importLocale(locale));
	const appKeys = new Set();
	for (const app of APP_VIEWS) {
		for (const [k, v] of flattenKeys(await importLocale(locale, app))) {
			keys.set(k, v);
			appKeys.add(k);
		}
	}
	return { keys, appKeys };
}

const USAGE_PATTERNS = [
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

/** Keys and namespaces a source file references (added to `into`). */
export function usedKeysIn(content, into = new Set()) {
	for (const pattern of USAGE_PATTERNS) {
		for (const match of content.matchAll(pattern)) into.add(match[1]);
	}
	return into;
}

/**
 * Keys none of whose prefixes is referenced. A namespace counts for its
 * whole subtree (`useTranslations("desktop.x")` + `t("k")` → `desktop.x.k`).
 */
export function findUnusedKeys(keys, used) {
	const unused = [];
	for (const key of keys) {
		const parts = key.split(".");
		let found = false;
		for (let i = parts.length; i >= 1; i--) {
			if (used.has(parts.slice(0, i).join("."))) {
				found = true;
				break;
			}
		}
		if (!found) unused.push(key);
	}
	return unused;
}
