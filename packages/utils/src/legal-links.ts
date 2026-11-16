export interface LegalLinkOptions {
	/** Marketing site base URL (`NEXT_PUBLIC_MARKETING_URL`); unset → no links. */
	marketingUrl: string | undefined;
	locale: string;
	defaultLocale: string;
}

/**
 * Absolute URL of a marketing legal page (`/legal/<slug>`). Marketing uses
 * `localePrefix: "as-needed"`: the default locale has no prefix. `null`
 * without a marketing URL.
 */
export function legalPageUrl(
	slug: string,
	{ marketingUrl, locale, defaultLocale }: LegalLinkOptions,
): string | null {
	if (!marketingUrl) return null;
	const base = marketingUrl.replace(/\/+$/, "");
	const prefix = locale === defaultLocale ? "" : `/${locale}`;
	return `${base}${prefix}/legal/${slug}`;
}

/**
 * Privacy + imprint URLs for apps that link to the marketing site's legal
 * pages (§ 5 DDG: reachable from every page). `null` when legal pages are
 * switched off (`enabled`) or no marketing URL is configured.
 */
export function legalLinks(
	options: LegalLinkOptions & { enabled: boolean },
): { privacy: string; imprint: string } | null {
	if (!options.enabled) return null;
	const privacy = legalPageUrl("privacy", options);
	const imprint = legalPageUrl("imprint", options);
	return privacy && imprint ? { privacy, imprint } : null;
}
