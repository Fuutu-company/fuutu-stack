import { analyticsConfig } from "./config";

/**
 * Build the `document.cookie` assignment string for the consent decision.
 *
 * The cookie is intentionally host-scoped: no `domain=` attribute is set,
 * so the browser scopes it to the exact host. Deriving a parent domain by
 * slicing hostname labels is unsafe — `app.example.co.uk` would produce
 * `domain=.co.uk`, a public suffix browsers reject, which silently breaks
 * consent persistence. Cross-subdomain sharing stays opt-in via
 * `analyticsConfig.consentCookieDomain` (e.g. `.example.com`).
 */
export function buildConsentCookie(
	value: "granted" | "denied",
	opts: { secure?: boolean } = {},
): string {
	const parts = [
		`${analyticsConfig.consentCookieName}=${value}`,
		`max-age=${analyticsConfig.consentCookieMaxAge}`,
		"path=/",
		"SameSite=Lax",
	];
	if (analyticsConfig.consentCookieDomain) {
		parts.push(`domain=${analyticsConfig.consentCookieDomain}`);
	}
	if (opts.secure) {
		parts.push("Secure");
	}
	return parts.join("; ");
}
