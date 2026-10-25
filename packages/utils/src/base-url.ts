// `window` is re-declared locally (narrower than the DOM lib global) because
// consumers compile these sources under their own tsconfig — e.g. @fuutu/api
// uses lib: ESNext without DOM, where the DOM `window` global does not exist.
declare const window: { location: { origin: string } } | undefined;

/**
 * Resolves the public base URL for the current runtime.
 * Priority: explicit override → Vercel URL → localhost dev fallback.
 *
 * Reads `process.env` directly (documented exception, like @fuutu/logs) —
 * @fuutu/utils is the foundational package: getBaseUrl must stay isomorphic
 * (runs client-side) and importable by apps/marketing, which must not pull
 * in @fuutu/env/saas. VERCEL_URL/PORT are also deployment-platform vars
 * intentionally absent from the env schema.
 */
export function getBaseUrl(
	options: { override?: string; defaultPort?: number } = {},
): string {
	const { override, defaultPort = 3000 } = options;
	if (override) return stripTrailingSlash(override);

	if (typeof window !== "undefined") {
		return window.location.origin;
	}

	const vercel = process.env.VERCEL_URL;
	if (vercel) return `https://${vercel}`;

	const port = process.env.PORT ?? String(defaultPort);
	return `http://localhost:${port}`;
}

function stripTrailingSlash(url: string): string {
	return url.endsWith("/") ? url.slice(0, -1) : url;
}
