import { config } from "@fuutu/config";
import { APP_VERSION } from "@fuutu/config/app-version";
import type { AnyMcpPrompt, AnyMcpTool, McpEndpointOptions } from "@fuutu/mcp";
import { apiConfig } from "../config";
import { getMcpChallenge, resolveMcpPrincipal } from "./principal";
import { appInfoTool, whoamiTool } from "./tools";

/**
 * Your MCP server — the one file to edit for `/api/mcp`.
 *
 * - `tools` / `prompts`: register your `defineMcpTool` / `defineMcpPrompt`
 *   definitions here.
 * - `resolvePrincipal`: who the caller is (kit default: org API key with the
 *   `mcp` scope, or an MCP OAuth token). Swap it for your own credential
 *   scheme; return a `Response` (401/402 …) to stop a request.
 * - `wrapTool`: optional middleware around every tool call — quotas,
 *   auditing, metering. Throw `McpToolError` to deny with a message.
 *
 * Kit plumbing — rate limiting, `apiConfig.mcp.auth`, error logging — is
 * applied in `./index.ts` on top of this definition; you don't need to
 * touch it.
 */
export const mcpServer = {
	name: config.app.name,
	version: APP_VERSION,
	instructions: apiConfig.mcp.instructions,
	challenge: getMcpChallenge(),
	tools: [appInfoTool, whoamiTool] satisfies AnyMcpTool[],
	prompts: [] satisfies AnyMcpPrompt[],
	resolvePrincipal: resolveMcpPrincipal,
	wrapTool: undefined,
} satisfies Omit<McpEndpointOptions, "auth" | "onError">;
