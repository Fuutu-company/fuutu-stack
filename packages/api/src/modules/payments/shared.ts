import { getBaseUrl, getSafeRedirect } from "@fuutu/utils";

export function sanitizePaymentUrl(
	url: string | undefined,
): string | undefined {
	if (!url) return undefined;
	const base = getBaseUrl();
	const safe = getSafeRedirect(url, { allowedOrigins: [base] });
	return safe.startsWith("/") ? `${base}${safe}` : safe;
}
