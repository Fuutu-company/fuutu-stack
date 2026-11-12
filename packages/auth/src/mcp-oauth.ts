import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import { verifyBearerToken } from "better-auth/oauth2";
import { authConfig } from "./config";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * OAuth resources must be https (RFC 9728 / the MCP plugin rejects others);
 * plain http is only allowed on loopback for local development.
 */
export function canServeMcpOAuth(baseUrl: string): boolean {
	const url = new URL(baseUrl);
	return url.protocol === "https:" || LOOPBACK_HOSTS.has(url.hostname);
}

/** Access-token claim carrying the organization the user consented for. */
export const MCP_ORG_CLAIM = "org_id";

/**
 * OAuth 2.1 endpoints for MCP clients, all on the app origin:
 * the issuer is the origin itself so `/.well-known/oauth-authorization-server`
 * at the root is the RFC 8414 location (no issuer path to insert), while the
 * Better Auth endpoints stay under `/api/auth`.
 */
export function getMcpOAuthUrls(baseUrl: string) {
	const origin = new URL(baseUrl).origin;
	return {
		issuer: origin,
		resource: `${origin}/api/mcp`,
		jwksUrl: `${origin}/api/auth/jwks`,
		protectedResourceMetadataUrl: `${origin}/.well-known/oauth-protected-resource/api/mcp`,
	};
}

const urls = getMcpOAuthUrls(env.BETTER_AUTH_URL);

const active =
	authConfig.mcpOAuth.enabled && canServeMcpOAuth(env.BETTER_AUTH_URL);

if (authConfig.mcpOAuth.enabled && !active) {
	// Don't take the app down (e.g. a plain-http rehearsal on a server IP):
	// MCP keeps working with API keys, OAuth stays off until https.
	createLogger({ scope: "auth" }).warn(
		"MCP OAuth disabled: BETTER_AUTH_URL must be https (or loopback) — API keys still work",
		{ betterAuthUrl: env.BETTER_AUTH_URL },
	);
}

export const mcpOAuth = {
	...urls,
	/** authConfig.mcpOAuth.enabled AND an https (or loopback) app URL. */
	active,
	/** RFC 9728 `WWW-Authenticate` value — MCP clients start OAuth from it. */
	challenge: `Bearer resource_metadata="${urls.protectedResourceMetadataUrl}"`,
};

export type McpAccessTokenClaims = Awaited<
	ReturnType<typeof verifyBearerToken>
>;

/**
 * Verifies an OAuth access token presented to `/api/mcp`: signature via the
 * JWKS, issuer, audience (the MCP resource), expiry, and `azp` (same checks
 * as `requireMcpAuth` from `@better-auth/mcp`). Throws when invalid.
 */
export function verifyMcpAccessToken(
	token: string,
): Promise<McpAccessTokenClaims> {
	return verifyBearerToken(token, {
		verifyOptions: {
			issuer: mcpOAuth.issuer,
			audience: mcpOAuth.resource,
			requiredClaims: ["azp"],
		},
		jwksUrl: mcpOAuth.jwksUrl,
	});
}
