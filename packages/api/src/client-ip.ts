import { isIP } from "node:net";
import { apiConfig } from "./config";

/**
 * Client IP for rate limiting, or `null` when it can't be trusted.
 *
 * Forwarding headers are client-supplied unless a trusted reverse proxy
 * (Traefik in Coolify, nginx, a load balancer) writes them — so they are
 * read only with `apiConfig.rateLimit.trustProxyHeaders`. The right-most
 * `X-Forwarded-For` entry is the one the nearest proxy appended; entries
 * left of it can be forged by the client. Behind a CDN that entry is the
 * edge node, so `clientIpHeader` (`TRUSTED_CLIENT_IP_HEADER`, e.g.
 * `cf-connecting-ip`) names the header the edge sets with the client IP.
 */
export function getClientIp(
	headers: Headers,
	trustProxyHeaders: boolean = apiConfig.rateLimit.trustProxyHeaders,
	clientIpHeader: string | undefined = apiConfig.rateLimit.clientIpHeader,
): string | null {
	if (!trustProxyHeaders) return null;
	// One IP address only: anything else (a list, a client-chosen string
	// when the origin is reachable without the CDN) falls back below.
	const fromEdge = clientIpHeader && headers.get(clientIpHeader)?.trim();
	if (fromEdge && isIP(fromEdge) !== 0) return fromEdge;
	const forwarded = headers
		.get("x-forwarded-for")
		?.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean)
		.at(-1);
	return forwarded || headers.get("x-real-ip")?.trim() || null;
}
