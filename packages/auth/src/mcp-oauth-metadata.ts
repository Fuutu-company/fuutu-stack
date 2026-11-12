import {
	metadataResponse,
	oauthProviderAuthServerMetadata,
} from "@better-auth/oauth-provider";
import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client";
import { auth } from "./index";
import { mcpOAuth } from "./mcp-oauth";

// Public discovery documents — no credentials, so any origin may read them
// (browser-based MCP clients such as the MCP Inspector).
const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

const notFound = async () => new Response(null, { status: 404 });

const resourceClient = oauthProviderResourceClient(auth).getActions();

/** RFC 8414 `/.well-known/oauth-authorization-server` (issuer = app origin). */
export const authorizationServerMetadata: (
	request: Request,
) => Promise<Response> = mcpOAuth.active
	? oauthProviderAuthServerMetadata(auth, { headers: CORS_HEADERS })
	: notFound;

/** RFC 9728 `/.well-known/oauth-protected-resource[/api/mcp]` for `/api/mcp`. */
export const protectedResourceMetadata: (
	request: Request,
) => Promise<Response> = mcpOAuth.active
	? async () =>
			metadataResponse(
				await resourceClient.getProtectedResourceMetadata({
					resource: mcpOAuth.resource,
					authorization_servers: [mcpOAuth.issuer],
					bearer_methods_supported: ["header"],
				}),
				CORS_HEADERS,
			)
	: notFound;
