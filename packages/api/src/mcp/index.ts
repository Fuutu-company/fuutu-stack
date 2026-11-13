import { createLogger } from "@fuutu/logs";
import {
	createMcpEndpoint,
	extractBearerToken,
	type McpPrincipal,
} from "@fuutu/mcp";
import { defaultRateLimitStore } from "@fuutu/utils/rate-limit";
import { apiConfig } from "../config";
import { API_KEY_HEADER } from "../context";
import { throttlePreAuth } from "../pre-auth-throttle";
import { checkMcpRateLimit } from "./rate-limit";
import { mcpServer } from "./server";

const log = createLogger({ scope: "mcp" });

/** Tools and prompts of the app's MCP server (defined in `./server.ts`). */
export const mcpTools = mcpServer.tools;
export const mcpPrompts = mcpServer.prompts;

async function resolveRateLimited(
	request: Request,
): Promise<McpPrincipal | Response> {
	// A presented credential costs a lookup before the per-credential limit
	// below can apply — rejected credentials (401) are counted per client
	// IP, so random-token floods get 429 instead of unbounded DB/token
	// verification.
	const attempt = extractBearerToken(request.headers, API_KEY_HEADER)
		? await throttlePreAuth(
				request.headers,
				"mcp",
				apiConfig.mcp.rateLimit.preAuth,
			)
		: null;
	if (attempt?.limited) return attempt.limited;
	const principal = await mcpServer.resolvePrincipal(request);
	if (principal instanceof Response) {
		if (principal.status === 401) await attempt?.recordFailure();
		return principal;
	}
	if (apiConfig.rateLimit.enabled) {
		const limited = await checkMcpRateLimit(
			principal,
			request.headers,
			apiConfig.mcp.rateLimit,
			defaultRateLimitStore,
		);
		if (limited) return limited;
	}
	return principal;
}

export const handleMcpRequest = createMcpEndpoint({
	...mcpServer,
	auth: apiConfig.mcp.auth,
	resolvePrincipal: resolveRateLimited,
	onError: (error, meta) => log.error("mcp handler error", { error, ...meta }),
});
