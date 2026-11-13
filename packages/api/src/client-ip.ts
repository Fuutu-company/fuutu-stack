import { apiConfig } from "./config";

/**
 * Client IP for rate limiting, or `null` when it can't be trusted.
 *
 * Forwarding headers are client-supplied unless a trusted reverse proxy
 * (Traefik in Coolify, nginx, a load balancer) writes them — so they are
 * read only with `apiConfig.rateLimit.trustProxyHeaders`. The right-most
 * `X-Forwarded-For` entry is the one the nearest proxy appended; entries
 * left of it can be forged by the client.
 */
export function getClientIp(
	headers: Headers,
	trustProxyHeaders: boolean = apiConfig.rateLimit.trustProxyHeaders,
): string | null {
	if (!trustProxyHeaders) return null;
	const forwarded = headers
		.get("x-forwarded-for")
		?.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean)
		.at(-1);
	return forwarded || headers.get("x-real-ip")?.trim() || null;
}
