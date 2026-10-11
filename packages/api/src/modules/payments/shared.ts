import { env } from "@fuutu/env/saas";
import { getBaseUrl, getSafeRedirect } from "@fuutu/utils";

export function sanitizePaymentUrl(
	url: string | undefined,
): string | undefined {
	if (!url) return undefined;
	// getBaseUrl() only knows VERCEL_URL/PORT — on every other deployment
	// (Docker, Railway, custom host) it yields localhost and legitimate
	// absolute success/cancel URLs would be rejected. The canonical public
	// URL is NEXT_PUBLIC_SAAS_URL, with BETTER_AUTH_URL as fallback.
	const base = env.NEXT_PUBLIC_SAAS_URL ?? env.BETTER_AUTH_URL ?? getBaseUrl();
	const safe = getSafeRedirect(url, { allowedOrigins: [base] });
	return safe.startsWith("/") ? `${base}${safe}` : safe;
}
