export type OriginGuardConfig = {
	/** The incoming request URL — internal host under Next.js standalone. */
	requestUrl: string;
	/** Public origin of this app (BETTER_AUTH_URL). */
	appUrl: string;
	/** Extra trusted origin for credentialed cross-site calls (CORS_ORIGIN). */
	corsOrigin: string | undefined;
};

function hostOf(url: string | undefined): string | null {
	if (!url) return null;
	try {
		return new URL(url).host;
	} catch {
		return null;
	}
}

/**
 * CSRF origin check for mutating requests. The app's configured public
 * origin must be trusted explicitly: Next.js standalone servers build
 * `request.url` from HOSTNAME (e.g. `0.0.0.0:3000`), so behind a reverse
 * proxy the request host never equals the browser's origin.
 */
export function isOriginAllowed(
	origin: string,
	config: OriginGuardConfig,
): boolean {
	const originHost = hostOf(origin);
	if (!originHost) return false;
	const allowed = [config.requestUrl, config.appUrl, config.corsOrigin]
		.map(hostOf)
		.filter((host): host is string => host !== null);
	return allowed.includes(originHost);
}
