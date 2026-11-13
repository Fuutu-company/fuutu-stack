import { authorizationServerMetadata } from "@fuutu/auth/mcp-oauth-metadata";

/**
 * RFC 8414 authorization-server metadata for MCP clients. Lives outside
 * `/api` because the issuer is the app origin (authConfig.mcpOAuth).
 */
export function GET(request: Request) {
	return authorizationServerMetadata(request);
}
