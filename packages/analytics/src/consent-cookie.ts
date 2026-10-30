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

/**
 * Read the consent decision cookie. Returns the raw stored value
 * (`"granted"` / `"denied"`) or null when absent or malformed — a
 * foreign cookie containing a bare `%` must never crash the caller.
 */
export function readConsentCookie(): string | null {
	if (typeof document === "undefined") return null;
	const name = `${analyticsConfig.consentCookieName}=`;
	const found = document.cookie
		.split(";")
		.map((c) => c.trim())
		.find((c) => c.startsWith(name));
	if (!found) return null;
	try {
		return decodeURIComponent(found.substring(name.length));
	} catch {
		return null;
	}
}

export function writeConsentCookie(value: "granted" | "denied") {
	if (typeof document === "undefined") return;
	// Consent must be readable from JS (useConsent + <AnalyticsScript />),
	// so httpOnly is not an option — SameSite=Lax still applies.
	// biome-ignore lint/suspicious/noDocumentCookie: JS-readable consent cookie by design
	document.cookie = buildConsentCookie(value, {
		secure: window.location.protocol === "https:",
	});
}
