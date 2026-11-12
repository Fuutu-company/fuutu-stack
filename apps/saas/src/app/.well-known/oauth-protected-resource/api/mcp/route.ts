import { protectedResourceMetadata } from "@fuutu/auth/mcp-oauth-metadata";

/**
 * RFC 9728 protected-resource metadata at the path-suffixed location MCP
 * clients derive from the `/api/mcp` resource URL.
 */
export function GET(request: Request) {
	return protectedResourceMetadata(request);
}
