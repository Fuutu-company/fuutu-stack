"use client";

import { useLocale } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * Resolves the best available image path for the current locale + theme.
 *
 * Convention: place images in `public/` using the pattern:
 *   <base>.<locale>.<theme>.<ext>   →  /screenshots/dashboard.en.light.webp
 *
 * Fallback tree (most specific → least specific):
 *   1. <base>.<locale>.<theme>.<ext>
 *   2. <base>.<locale>.<ext>
 *   3. <base>.en.<theme>.<ext>
 *   4. <base>.en.<ext>
 *   5. <base>.<ext>
 *   6. null  →  caller shows placeholder
 *
 * **Performance note**: resolution is async — the hook fires up to 5 sequential
 * `HEAD` requests on mount and on every `[base, ext, locale, resolvedTheme]`
 * change. `src` starts as `null` until the first successful response; callers
 * should render a placeholder or skeleton while `src === null`.
 * For static deployments where candidates are known ahead of time, pass a
 * pre-resolved string directly instead of using this hook.
 *
 * @param base   Path without locale/theme suffix, e.g. "/screenshots/dashboard"
 * @param ext    File extension without dot. Default: "webp"
 *
 * @example
 * const src = useLocaleThemeImage("/screenshots/dashboard");
 * // On de + dark → tries "/screenshots/dashboard.de.dark.webp" first
 */
export function useLocaleThemeImage(base: string, ext = "webp"): string | null {
	const locale = useLocale();
	const { resolvedTheme } = useTheme();
	const [src, setSrc] = useState<string | null>(null);

	useEffect(() => {
		if (!resolvedTheme) return;

		const theme = resolvedTheme === "dark" ? "dark" : "light";

		const candidates = [
			`${base}.${locale}.${theme}.${ext}`,
			`${base}.${locale}.${ext}`,
			`${base}.en.${theme}.${ext}`,
			`${base}.en.${ext}`,
			`${base}.${ext}`,
		];

		let cancelled = false;

		async function resolve() {
			for (const candidate of candidates) {
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
