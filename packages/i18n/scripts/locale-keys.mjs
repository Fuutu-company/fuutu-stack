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

// Generic patterns for calls whose translator is not bound in the file
// (a `t` passed in as a prop or argument): the key is relative to an
// unknown namespace, so only a full key path can match. The namespace
// itself is counted where the translator leaves its file (see below).
const UNBOUND_PATTERNS = [
	// Static: t("key"), t('key'), t(`key`) — plus t.has()/t.raw()/t.rich()
	/\bt(?:\.(?:has|raw|rich|markup))?\(["'`]([^"'`]+)["'`]/g,
	// Template literals: t(`prefix.${var}`) → "prefix".
	/\bt(?:\.(?:has|raw|rich|markup))?\(`([^`${}]+)\.\$\{[^}]+\}`/g,
	// Property access: messages.cron.subscriptionReminder.title, messages.nav.docs
	/\bmessages\.([a-zA-Z0-9_.]+)/g,
	// labelKey: "key" pattern in footer/navbar
	/\blabelKey:\s*["'`]([^"'`]+)["'`]/g,
];

// `useTranslations("ns")` / `getTranslations("ns")` /
// `getTranslations({ …, namespace: "ns" })` / no namespace (full keys).
const TRANSLATOR_CALL =
	/\b(?:useTranslations|getTranslations)\(\s*(?:(["'`])([^"'`$]*)\1|\{[^}]*?\bnamespace:\s*(["'`])([^"'`$]*)\3[^}]*\}|\{[^}]*\})?\s*\)/g;

// `const tX = (await) useTranslations(…)` — a translator bound to a name.
const BINDING = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?$/;

const METHOD = String.raw`(?:\.(?:rich|raw|has|markup))?`;

const DOTTED_LITERAL = /(["'`])([A-Za-z][\w-]*(?:\.[\w-]+)+)\1/g;

const join = (ns, key) => (ns ? `${ns}.${key}` : key);

/**
 * What one use of a bound translator marks: `t("k")` → `ns.k`;
 * `t(\`rows.${id}\`)` → `ns.rows`; any other argument, or the translator
 * leaving the call position (prop, argument, return) → the whole `ns`.
 */
function markUse(rest, ns, into, content) {
	const call = rest.match(new RegExp(`^\\s*${METHOD}\\(\\s*`));
	if (!call) {
		if (ns) into.add(ns);
		// A namespace-less translator handed to a helper takes full keys
		// along with it (`planGateMessage(e, t, "webhooks.failed")`): count
		// the file's dotted string literals.
		else for (const m of content.matchAll(DOTTED_LITERAL)) into.add(m[2]);
		return;
	}
	const arg = rest.slice(call[0].length);
	const literal = arg.match(/^(["'])([^"'\n]*)\1\s*[,)]/);
	if (literal) {
		into.add(join(ns, literal[2]));
		return;
	}
	const template = arg.match(/^`([^`]*)`/);
	if (template) {
		const text = template[1];
		const dynamic = text.indexOf("${");
		if (dynamic === -1) {
			into.add(join(ns, text));
			return;
		}
		const fixed = text.slice(0, dynamic);
		const lastDot = fixed.lastIndexOf(".");
		if (lastDot > 0) into.add(join(ns, fixed.slice(0, lastDot)));
		else if (ns) into.add(ns);
		return;
	}
	// t(key), t(cond ? "a" : "b"), … — the key is not static.
	if (ns) into.add(ns);
}

/**
 * Keys and namespaces a source file references (added to `into`).
 *
 * A translator bound to a name (`const tFooter = useTranslations("footer")`)
 * marks only the keys it is called with (`footer.<key>`), paired with the
 * nearest binding of that name before the call. Its whole namespace counts
 * as used only when it gets a dynamic key (a template literal marks its
 * static prefix) or leaves the file (passed as prop or argument). A
 * `useTranslations("ns")` that is not bound to a name counts for all of
 * `ns`. A namespace-less translator (`useTranslations()`) that escapes
 * marks nothing: where it goes, its calls use full keys, which the
 * unbound patterns catch.
 */
export function usedKeysIn(content, into = new Set()) {
	for (const pattern of UNBOUND_PATTERNS) {
		for (const match of content.matchAll(pattern)) into.add(match[1]);
	}

	/** name → [{ at, end, ns }] in source order */
	const bindings = new Map();
	for (const match of content.matchAll(TRANSLATOR_CALL)) {
		const ns = match[2] ?? match[4] ?? "";
		const before = content.slice(Math.max(0, match.index - 120), match.index);
		const bound = before.match(BINDING);
		if (!bound) {
			if (ns) into.add(ns);
			continue;
		}
		const name = bound[1];
		const list = bindings.get(name) ?? [];
		list.push({ at: match.index, end: match.index + match[0].length, ns });
		bindings.set(name, list);
	}

	for (const [name, list] of bindings) {
		const uses = new RegExp(
			`(?<![\\w$.])${name.replace(/\$/g, "\\$")}(?![\\w$])`,
			"g",
		);
		for (const use of content.matchAll(uses)) {
			const binding = list.filter((b) => b.at <= use.index).at(-1);
			if (!binding) continue; // used before any binding: another scope
			// The name in its own `const name =` declaration.
			const rest = content.slice(use.index + name.length);
			if (/^\s*=(?!=)/.test(rest)) continue;
			// A property key or type annotation named like the translator
			// (`{ t: … }`) counts as the translator leaving.
			markUse(rest, binding.ns, into, content);
		}
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
