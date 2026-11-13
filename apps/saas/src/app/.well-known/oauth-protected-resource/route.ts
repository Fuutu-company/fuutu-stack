import { protectedResourceMetadata } from "@fuutu/auth/mcp-oauth-metadata";

/** RFC 9728 protected-resource metadata for `/api/mcp` (root variant). */
export function GET(request: Request) {
	return protectedResourceMetadata(request);
}
