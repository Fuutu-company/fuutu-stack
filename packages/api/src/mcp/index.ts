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
import { resolveMcpPrincipal } from "./principal";
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
	// Anonymous callers share one bucket — forwarding headers are spoofable
	// unless apiConfig.rateLimit.trustProxyHeaders is set behind a proxy.
	const bucket =
		principal.kind === "user"
			? `mcp:${principal.credentialId}`
			: "mcp:anonymous";
	if (apiConfig.rateLimit.enabled) {
		const result = await defaultRateLimitStore.check(
			bucket,
			apiConfig.mcp.rateLimit,
		);
		if (!result.allowed) {
			return new Response(JSON.stringify({ error: "rate_limited" }), {
				status: 429,
				headers: { "content-type": "application/json" },
			});
		}
	}
	return principal;
}

export const handleMcpRequest = createMcpEndpoint({
	name: config.app.name,
	version: APP_VERSION,
	auth: apiConfig.mcp.auth,
	instructions: apiConfig.mcp.instructions,
	tools: mcpTools,
	prompts: mcpPrompts,
	resolvePrincipal: resolveRateLimited,
	onError: (error, meta) => log.error("mcp handler error", { error, ...meta }),
});
