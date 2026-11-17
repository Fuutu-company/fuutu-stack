import { analyticsConfig } from "./config";

const RELATIVE_BASE = "http://relative.invalid";
const RELATIVE_ORIGIN = new URL(RELATIVE_BASE).origin;

/**
 * Drops the query params named in `analyticsConfig.redactedQueryParams`
 * (case-insensitive) from a relative or absolute URL, so auth links
 * (`?token=`, `?email=`, `?id=`, …) never reach the analytics provider.
 * A value that is itself a relative URL (`?redirect=/auth/verify?token=…`)
 * is redacted the same way. Other params (`utm_*`) and the hash stay.
 * Unparseable input passes through unchanged.
 */
export function redactUrl(url: string): string {
	if (!url.includes("?")) return url;
	const redacted = new Set(
		analyticsConfig.redactedQueryParams.map((name) => name.toLowerCase()),
	);
	let parsed: URL;
	try {
		parsed = new URL(url, RELATIVE_BASE);
	} catch {
		return url;
	}
	const kept = new URLSearchParams();
	for (const [key, value] of parsed.searchParams) {
		if (redacted.has(key.toLowerCase())) continue;
		kept.append(key, value.startsWith("/") ? redactUrl(value) : value);
	}
	const search = kept.size > 0 ? `?${kept.toString()}` : "";
	const rest = `${parsed.pathname}${search}${parsed.hash}`;
	return parsed.origin === RELATIVE_ORIGIN ? rest : `${parsed.origin}${rest}`;
}
