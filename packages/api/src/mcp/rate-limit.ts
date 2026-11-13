import type { McpPrincipal } from "@fuutu/mcp";
import type { RateLimitStore } from "@fuutu/utils/rate-limit";
import { getClientIp } from "../client-ip";
import { rateLimitedResponse } from "../pre-auth-throttle";

export type McpRateLimits = {
	anonymous: { maxRequests: number; windowMs: number };
	authenticated: { maxRequests: number; windowMs: number };
};

/**
 * Rate-limit bucket for an MCP request: one per credential for signed-in
 * callers, one per client IP for anonymous callers (one shared bucket when
 * the IP can't be trusted — see getClientIp).
 */
export function mcpRateLimitBucket(
	principal: McpPrincipal,
	headers: Headers,
): string {
	if (principal.kind === "user") return `mcp:key:${principal.credentialId}`;
	const ip = getClientIp(headers);
	return ip ? `mcp:ip:${ip}` : "mcp:anonymous";
}

/** `null` when allowed, otherwise the 429 response to return. */
export async function checkMcpRateLimit(
	principal: McpPrincipal,
	headers: Headers,
	limits: McpRateLimits,
	store: RateLimitStore,
): Promise<Response | null> {
	const limit =
		principal.kind === "user" ? limits.authenticated : limits.anonymous;
	const result = await store.check(
		mcpRateLimitBucket(principal, headers),
		limit,
	);
	if (result.allowed) return null;
	return rateLimitedResponse(result.resetAt);
}
