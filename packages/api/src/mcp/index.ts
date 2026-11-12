import { config } from "@fuutu/config";
import { APP_VERSION } from "@fuutu/config/app-version";
import { createLogger } from "@fuutu/logs";
import {
	type AnyMcpPrompt,
	type AnyMcpTool,
	createMcpEndpoint,
	type McpPrincipal,
} from "@fuutu/mcp";
import { defaultRateLimitStore } from "@fuutu/utils/rate-limit";
import { apiConfig } from "../config";
import { getMcpChallenge, resolveMcpPrincipal } from "./principal";
import { checkMcpRateLimit } from "./rate-limit";
import { appInfoTool, whoamiTool } from "./tools";

const log = createLogger({ scope: "mcp" });

/** Register your MCP tools and prompts here. */
export const mcpTools: AnyMcpTool[] = [appInfoTool, whoamiTool];
export const mcpPrompts: AnyMcpPrompt[] = [];

async function resolveRateLimited(
	request: Request,
): Promise<McpPrincipal | Response> {
	const principal = await resolveMcpPrincipal(request);
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
	name: config.app.name,
	version: APP_VERSION,
	auth: apiConfig.mcp.auth,
	challenge: getMcpChallenge(),
	instructions: apiConfig.mcp.instructions,
	tools: mcpTools,
	prompts: mcpPrompts,
	resolvePrincipal: resolveRateLimited,
	onError: (error, meta) => log.error("mcp handler error", { error, ...meta }),
});
