import {
	type AuthInfo,
	createMcpHandler,
	McpServer,
} from "@modelcontextprotocol/server";
import { canAccess } from "./define";
import { McpToolError } from "./errors";
import type {
	AnyMcpPrompt,
	AnyMcpTool,
	McpPrincipal,
	McpUserPrincipal,
} from "./types";

export type McpEndpointOptions = {
	/** Server name reported to clients. */
	name: string;
	/** Server version reported to clients (use your APP_VERSION). */
	version: string;
	/**
	 * `optional`: anonymous callers get the public surface; credentials
	 * unlock more. `required`: anonymous callers get 401 (triggers the
	 * client's auth flow).
	 */
	auth: "optional" | "required";
	tools: readonly AnyMcpTool[];
	prompts?: readonly AnyMcpPrompt[];
	/** Always-loaded server instructions (keep < 4 KB). */
	instructions?: string | ((principal: McpPrincipal) => string | undefined);
	/**
	 * Verifies the request credential. Return a principal, or a `Response`
	 * (401/402/429 …) to stop the request — e.g. for an invalid key.
	 */
	resolvePrincipal: (request: Request) => Promise<McpPrincipal | Response>;
	/** Receives unexpected errors (internal details never reach the client). */
	onError?: (error: unknown, meta: { tool?: string; prompt?: string }) => void;
};

const PRINCIPAL_KEY = "fuutuPrincipal";

const unauthorized = () =>
	new Response(
		JSON.stringify({
			jsonrpc: "2.0",
			id: null,
			error: { code: -32001, message: "Authentication required" },
		}),
		{
			status: 401,
			headers: {
				"content-type": "application/json",
				"www-authenticate": 'Bearer realm="mcp"',
			},
		},
	);

function toToolResult(value: unknown) {
	if (typeof value === "string") {
		return { content: [{ type: "text" as const, text: value }] };
	}
	const text = JSON.stringify(value ?? null);
	const isRecord =
		typeof value === "object" && value !== null && !Array.isArray(value);
	return {
		content: [{ type: "text" as const, text }],
		...(isRecord
			? { structuredContent: value as Record<string, unknown> }
			: {}),
	};
}

function toolError(message: string) {
	return {
		isError: true,
		content: [{ type: "text" as const, text: message }],
	};
}

function principalFrom(authInfo: AuthInfo | undefined): McpPrincipal {
	const principal = authInfo?.extra?.[PRINCIPAL_KEY];
	return principal ? (principal as McpUserPrincipal) : { kind: "anonymous" };
}

/**
 * Builds a stateless MCP endpoint (`(Request) => Promise<Response>`) that
 * mounts in any fetch-based router (Hono, Next route handler, …).
 *
 * Every request gets a fresh server that only registers what the
 * resolved principal may access — hidden tools are neither listed nor
 * callable.
 */
export function createMcpEndpoint(options: McpEndpointOptions) {
	const handler = createMcpHandler(
		({ authInfo, requestInfo }) => {
			const principal = principalFrom(authInfo);
			const request = requestInfo ?? new Request("http://localhost/");
			const instructions =
				typeof options.instructions === "function"
					? options.instructions(principal)
					: options.instructions;
			const server = new McpServer(
				{ name: options.name, version: options.version },
				instructions ? { instructions } : undefined,
			);

			for (const tool of options.tools) {
				if (!canAccess(tool.access, principal)) continue;
				server.registerTool(
					tool.name,
					{
						title: tool.title,
						description: tool.description,
						inputSchema: tool.input,
						annotations: tool.annotations,
					},
					async (input: unknown) => {
						try {
							return toToolResult(
								await tool.handler(input, { principal, request }),
							);
						} catch (error) {
							if (error instanceof McpToolError) {
								return toolError(error.message);
							}
							options.onError?.(error, { tool: tool.name });
							return toolError("Internal error");
						}
					},
				);
			}

			for (const prompt of options.prompts ?? []) {
				if (!canAccess(prompt.access, principal)) continue;
				server.registerPrompt(
					prompt.name,
					{
						title: prompt.title,
						description: prompt.description,
						...(prompt.args ? { argsSchema: prompt.args } : {}),
					},
					async (args: unknown) => {
						try {
							const text = await prompt.render(args ?? {}, {
								principal,
								request,
							});
							return {
								messages: [
									{
										role: "user" as const,
										content: { type: "text" as const, text },
									},
								],
							};
						} catch (error) {
							options.onError?.(error, { prompt: prompt.name });
							throw new Error("Internal error");
						}
					},
				);
			}

			return server;
		},
		{
			onerror: (error) => options.onError?.(error, {}),
		},
	);

	return async function handle(request: Request): Promise<Response> {
		const resolved = await options.resolvePrincipal(request);
		if (resolved instanceof Response) return resolved;
		if (options.auth === "required" && resolved.kind === "anonymous") {
			return unauthorized();
		}
		const authInfo: AuthInfo | undefined =
			resolved.kind === "user"
				? {
						token: resolved.credentialId,
						clientId: resolved.credentialId,
						scopes: [...resolved.scopes],
						extra: { [PRINCIPAL_KEY]: resolved },
					}
				: undefined;
		return handler.fetch(request, authInfo ? { authInfo } : undefined);
	};
}
