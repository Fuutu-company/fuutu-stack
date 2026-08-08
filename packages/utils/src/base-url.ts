declare const window: { location: { origin: string } } | undefined;

/**
 * Resolves the public base URL for the current runtime.
 * Priority: explicit override → Vercel URL → localhost dev fallback.
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
