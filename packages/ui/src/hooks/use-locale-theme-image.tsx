"use client";

import { useEffect, useState } from "react";

/**
 * Build the ordered candidate paths for a locale+theme aware image.
 * Fallback order (most specific → least specific):
 *   1. <base>.<locale>.<theme>.<ext>
 *   2. <base>.<locale>.<ext>
 *   3. <base>.en.<theme>.<ext>
 *   4. <base>.en.<ext>
 *   5. <base>.<ext>
 *
 * Duplicates are removed, so `locale === "en"` yields a 3-entry list.
 */
export function buildImageCandidates(
	base: string,
	ext: string,
	locale: string,
	theme: string,
): string[] {
	return Array.from(
		new Set([
			`${base}.${locale}.${theme}.${ext}`,
			`${base}.${locale}.${ext}`,
			`${base}.en.${theme}.${ext}`,
			`${base}.en.${ext}`,
			`${base}.${ext}`,
		]),
	);
}

export type LocaleThemeImageContext = {
	/** Active locale, e.g. "de". Default: "en". */
	locale?: string;
	/** Resolved theme, e.g. "dark" or "light". Resolution waits for a value. */
	theme?: string;
};

/**
 * Resolves the best available image path for the current locale + theme.
 *
 * Convention: place images in `public/` using the pattern:
 *   <base>.<locale>.<theme>.<ext>   →  /screenshots/dashboard.de.dark.webp
 *
 * Resolution order (first `HEAD` request returning 2xx wins):
 *   1. <base>.<locale>.<theme>.<ext>
 *   2. <base>.<locale>.<ext>
 *   3. <base>.en.<theme>.<ext>
 *   4. <base>.en.<ext>
 *   5. <base>.<ext>
 *
 * If none resolve, `src` is `null` and the caller should render a
 * placeholder or skeleton. `src` also resets to `null` whenever the inputs
 * change or `theme` is still unresolved — never a stale path.
 *
 * Framework-agnostic: `locale` and `theme` are injected by the caller
 * (e.g. `useLocale()` / `useTheme().resolvedTheme` in a Next.js host).
 *
 * **Performance note**: resolution is async — the hook fires up to 5 sequential
 * `HEAD` requests on mount and on every `[base, ext, locale, theme]` change.
 * For static deployments where candidates are known ahead of time, pass a
 * pre-resolved string directly instead of using this hook.
 *
 * @param base     Path without locale/theme suffix, e.g. "/screenshots/dashboard"
 * @param ext      File extension without dot. Default: "webp"
 * @param context  Injected locale + theme from the host app
 *
 * @example
 * const src = useLocaleThemeImage("/screenshots/dashboard", "webp", {
 *   locale: useLocale(),
 *   theme: useTheme().resolvedTheme,
 * });
 * // On de + dark → tries "/screenshots/dashboard.de.dark.webp" first
 */
export function useLocaleThemeImage(
	base: string,
	ext = "webp",
	context: LocaleThemeImageContext = {},
): string | null {
	const { locale = "en", theme: resolvedTheme } = context;
	const [src, setSrc] = useState<string | null>(null);

	useEffect(() => {
		// Reset so a previous resolution never renders as a stale image
		// while inputs changed or the theme is still unresolved.
		setSrc(null);
		if (!resolvedTheme) return;

		const theme = resolvedTheme === "dark" ? "dark" : "light";
		const candidates = buildImageCandidates(base, ext, locale, theme);

		let cancelled = false;

		async function resolve() {
			for (const candidate of candidates) {
				if (cancelled) break;
				try {
					const res = await fetch(candidate, { method: "HEAD" });
					if (res.ok) {
						if (!cancelled) setSrc(candidate);
						return;
					}
				} catch {
					// network error — try next candidate
				}
			}
			if (!cancelled) setSrc(null);
		}

		resolve();
		return () => {
			cancelled = true;
		};
	}, [base, ext, locale, resolvedTheme]);

	return src;
}
