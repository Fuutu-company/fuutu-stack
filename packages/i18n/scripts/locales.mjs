/**
 * Enabled-locale detection for check-translations — kept dependency-free so
 * `node scripts/check-translations.mjs` needs no TypeScript loader. The
 * parser is verified against the real `i18nConfig` import in
 * src/__tests__/enabled-locales.test.ts.
 */

/** Blank out comments, keeping string literals (and offsets) intact. */
function blankComments(source) {
	let out = "";
	let state = null; // quote char | "line" | "block"
	for (let i = 0; i < source.length; i++) {
		const ch = source[i];
		const next = source[i + 1];
		if (state === "line") {
			if (ch === "\n") {
				state = null;
				out += ch;
			} else out += " ";
			continue;
		}
		if (state === "block") {
			if (ch === "*" && next === "/") {
				state = null;
				out += "  ";
				i++;
			} else out += ch === "\n" ? "\n" : " ";
			continue;
		}
		if (state !== null) {
			out += ch;
			if (ch === "\\") {
				out += next ?? "";
				i++;
			} else if (ch === state) state = null;
			continue;
		}
		if (ch === "'" || ch === '"' || ch === "`") {
			state = ch;
			out += ch;
		} else if (ch === "/" && next === "/") {
			state = "line";
			out += "  ";
			i++;
		} else if (ch === "/" && next === "*") {
			state = "block";
			out += "  ";
			i++;
		} else out += ch;
	}
	return out;
}

/**
 * Keys of the `locales: { … }` object in `i18nConfig`, in source order.
 * Returns null when the block cannot be located.
 */
export function parseConfiguredLocales(source) {
	const text = blankComments(source);
	const start = text.match(/\blocales\s*:\s*\{/);
	if (!start) return null;

	const keys = [];
	let depth = 0;
	let quote = null;
	let token = "";
	let tokenIsQuoted = false;
	let closed = false;

	for (let i = start.index + start[0].length - 1; i < text.length; i++) {
		const ch = text[i];

		if (quote !== null) {
			if (ch === "\\") i++;
			else if (ch === quote) quote = null;
			else if (depth === 1) token += ch;
			continue;
		}
		if (ch === "'" || ch === '"' || ch === "`") {
			quote = ch;
			if (depth === 1) {
				token = "";
				tokenIsQuoted = true;
			}
			continue;
		}
		if (ch === "{" || ch === "[" || ch === "(") {
			depth++;
			continue;
		}
		if (ch === "}" || ch === "]" || ch === ")") {
			depth--;
			if (depth === 0) {
				closed = true;
				break;
			}
			continue;
		}
		if (depth !== 1) continue;

		if (ch === ":") {
			const key = token.trim();
			if (key !== "") keys.push(key);
			token = "";
			tokenIsQuoted = false;
		} else if (ch === ",") {
			token = "";
			tokenIsQuoted = false;
		} else if (!tokenIsQuoted) {
			token += ch;
		}
	}

	return closed && keys.length > 0 ? keys : null;
}

/**
 * Split translation folders into enabled (configured and present), dormant
 * (present but not configured) and missing (configured but no folder).
 */
export function partitionLocaleDirs(dirs, configured) {
	return {
		enabled: dirs.filter((dir) => configured.includes(dir)),
		dormant: dirs.filter((dir) => !configured.includes(dir)),
		missing: configured.filter((locale) => !dirs.includes(locale)),
	};
}
