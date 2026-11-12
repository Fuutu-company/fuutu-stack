import { createLogger } from "@fuutu/logs";
import { createMcpEndpoint, type McpPrincipal } from "@fuutu/mcp";
import { defaultRateLimitStore } from "@fuutu/utils/rate-limit";
import { apiConfig } from "../config";
import { checkMcpRateLimit } from "./rate-limit";
import { mcpServer } from "./server";

const log = createLogger({ scope: "mcp" });

/** Tools and prompts of the app's MCP server (defined in `./server.ts`). */
export const mcpTools = mcpServer.tools;
export const mcpPrompts = mcpServer.prompts;

async function resolveRateLimited(
	request: Request,
): Promise<McpPrincipal | Response> {
	const principal = await mcpServer.resolvePrincipal(request);
	if (principal instanceof Response) return principal;
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
