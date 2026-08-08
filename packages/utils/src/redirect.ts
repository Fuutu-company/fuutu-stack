/**
 * Validates a redirect target to prevent open-redirect vulnerabilities.
 *
 * Accepts:
 * - `null`/`undefined`/empty → returns `fallback`
 * - Same-origin absolute URLs (if `allowedOrigins` contains their origin)
 * - Relative paths starting with `/` (but not `//` which are protocol-relative)
 *
 * Rejects everything else.
 */
export function getSafeRedirect(
	target: string | null | undefined,
	options: { fallback?: string; allowedOrigins?: string[] } = {},
): string {
	const { fallback = "/", allowedOrigins = [] } = options;

	if (!target || typeof target !== "string") return fallback;
	const trimmed = target.trim();
	if (trimmed.length === 0) return fallback;

	// Protocol-relative URLs (//evil.com) are unsafe.
	if (trimmed.startsWith("//")) return fallback;

	// Backslash bypass: browsers normalize `\` to `/`, so `/\evil.com`
	// becomes `//evil.com` (protocol-relative open redirect). Reject any
	// path whose second character is a backslash, control char, or
	// whitespace — all can be normalized away by browsers and turn a
	// seemingly-relative path into a protocol-relative URL.
	if (trimmed.startsWith("/")) {
		const next = trimmed.charCodeAt(1);
		// `\` (0x5C), control chars (0x00–0x1F), space (0x20), tab/newline.
		if (next === 0x5c || next <= 0x20) return fallback;
		return trimmed;
	}

	// Reject bare backslash-leading strings (same normalization risk).
	if (trimmed.startsWith("\\")) return fallback;

	// Absolute URL — only allow explicit allow-listed origins.
	try {
		const url = new URL(trimmed);
		if (allowedOrigins.includes(url.origin)) return url.toString();
		return fallback;
	} catch {
		return fallback;
	}
}
