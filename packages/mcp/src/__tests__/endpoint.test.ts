import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineMcpPrompt, defineMcpTool } from "../define";
import { createMcpEndpoint } from "../endpoint";
import { McpToolError } from "../errors";
import type { McpPrincipal } from "../types";
import { readRpc, rpcRequest } from "./helpers";

const user: McpPrincipal = {
	kind: "user",
	via: "api-key",
	credentialId: "key_1",
	userId: "user_1",
	organizationId: "org_1",
	orgRole: "admin",
	systemRole: "user",
	scopes: ["mcp"],
};

const tools = [
	defineMcpTool({
		name: "app_info",
		description: "Public app info",
		access: "public",
		input: z.object({}),
		handler: async () => ({ name: "Demo" }),
	}),
	defineMcpTool({
		name: "whoami",
		description: "Current user",
		access: "authenticated",
		input: z.object({}),
		handler: async (_input, ctx) => ({ userId: ctx.principal.userId }),
	}),
	defineMcpTool({
		name: "admin_only",
		description: "Org admins only",
		access: (principal) => principal.orgRole === "owner",
		input: z.object({ note: z.string().min(1) }),
		handler: async ({ note }) => ({ note }),
	}),
];

const prompts = [
	defineMcpPrompt({
		name: "public_prompt",
		description: "Visible to everyone",
		access: "public",
		render: () => "hello",
	}),
	defineMcpPrompt({
		name: "member_prompt",
		description: "Members only",
		access: "authenticated",
		render: (_args, ctx) => `hi ${ctx.principal.userId}`,
	}),
];

function endpoint(
	principal: McpPrincipal | Response,
	auth: "optional" | "required" = "optional",
) {
	return createMcpEndpoint({
		name: "test",
		version: "0.0.0",
		auth,
		tools,
		prompts,
		resolvePrincipal: async () => principal,
	});
}

async function listNames(
	handle: (req: Request) => Promise<Response>,
	method: "tools/list" | "prompts/list",
) {
	const body = await readRpc(await handle(rpcRequest(method)));
	const key = method === "tools/list" ? "tools" : "prompts";
	return ((body.result?.[key] ?? []) as { name: string }[]).map((t) => t.name);
}

describe("createMcpEndpoint", () => {
	it("answers initialize", async () => {
		const res = await endpoint({ kind: "anonymous" })(
			rpcRequest("initialize", {
				protocolVersion: "2025-11-25",
				capabilities: {},
				clientInfo: { name: "test", version: "1" },
			}),
		);
		expect(res.status).toBe(200);
		const body = await readRpc(res);
		expect(body.result?.serverInfo).toMatchObject({ name: "test" });
	});

	it("lists only public tools and prompts for anonymous callers", async () => {
		const handle = endpoint({ kind: "anonymous" });
		expect(await listNames(handle, "tools/list")).toEqual(["app_info"]);
		expect(await listNames(handle, "prompts/list")).toEqual(["public_prompt"]);
	});

	it("lists authenticated tools for users and applies predicates", async () => {
		const handle = endpoint(user);
		expect(await listNames(handle, "tools/list")).toEqual([
			"app_info",
			"whoami",
		]);
		const owner = endpoint({ ...user, orgRole: "owner" });
		expect(await listNames(owner, "tools/list")).toContain("admin_only");
	});

	it("passes the principal into tool handlers", async () => {
		const body = await readRpc(
			await endpoint(user)(
				rpcRequest("tools/call", { name: "whoami", arguments: {} }),
			),
		);
		expect(JSON.stringify(body.result)).toContain("user_1");
	});

	it("does not expose hidden tools to anonymous callers", async () => {
		const body = await readRpc(
			await endpoint({ kind: "anonymous" })(
				rpcRequest("tools/call", { name: "whoami", arguments: {} }),
			),
		);
		expect(JSON.stringify(body)).not.toContain("user_1");
		expect(body.error ?? body.result?.isError).toBeTruthy();
	});

	it("rejects anonymous callers with 401 when auth is required", async () => {
		const res = await endpoint(
			{ kind: "anonymous" },
			"required",
		)(rpcRequest("tools/list"));
		expect(res.status).toBe(401);
		expect(res.headers.get("www-authenticate")).toBe('Bearer realm="mcp"');
	});

	it("sends the configured challenge on 401 (OAuth discovery hint)", async () => {
		const challenge =
			'Bearer resource_metadata="https://app.example.com/.well-known/oauth-protected-resource/api/mcp"';
		const handle = createMcpEndpoint({
			name: "test",
			version: "0.0.0",
			auth: "required",
			challenge,
			tools,
			resolvePrincipal: async () => ({ kind: "anonymous" }),
		});
		const res = await handle(rpcRequest("tools/list"));
		expect(res.status).toBe(401);
		expect(res.headers.get("www-authenticate")).toBe(challenge);
	});

	it("returns the resolver's error response unchanged", async () => {
		const denied = new Response("nope", { status: 402 });
		const res = await endpoint(denied)(rpcRequest("tools/list"));
		expect(res.status).toBe(402);
	});

	it("serves 2026-07-28 clients (server/discover + per-request envelope)", async () => {
		const meta = {
			"io.modelcontextprotocol/protocolVersion": "2026-07-28",
			"io.modelcontextprotocol/clientInfo": { name: "test", version: "1" },
			"io.modelcontextprotocol/clientCapabilities": {},
		};
		const modern = { "mcp-protocol-version": "2026-07-28" };
		const handle = endpoint(user);
		const discover = await handle(
			rpcRequest(
				"server/discover",
				{ _meta: meta },
				{
					...modern,
					"mcp-method": "server/discover",
				},
			),
		);
		expect(discover.status).toBe(200);
		const body = await readRpc(
			await handle(
				rpcRequest(
					"tools/call",
					{ name: "whoami", arguments: {}, _meta: meta },
					{ ...modern, "mcp-method": "tools/call", "mcp-name": "whoami" },
				),
			),
		);
		expect(JSON.stringify(body.result)).toContain("user_1");
	});

	it("validates tool input", async () => {
		const body = await readRpc(
			await endpoint({ ...user, orgRole: "owner" })(
				rpcRequest("tools/call", {
					name: "admin_only",
					arguments: { note: "" },
				}),
			),
		);
		expect(body.result?.isError ?? body.error).toBeTruthy();
	});
});

describe("createMcpEndpoint — wrapTool hook", () => {
	const callWhoami = (handle: (req: Request) => Promise<Response>) =>
		handle(rpcRequest("tools/call", { name: "whoami", arguments: {} })).then(
			readRpc,
		);

	it("runs around every tool call with the tool, input and principal", async () => {
		const calls: { tool: string; input: unknown; userId?: string }[] = [];
		const handle = createMcpEndpoint({
			name: "test",
			version: "0.0.0",
			auth: "optional",
			tools,
			resolvePrincipal: async () => user,
			wrapTool: async (call, next) => {
				calls.push({
					tool: call.tool.name,
					input: call.input,
					userId:
						call.principal.kind === "user" ? call.principal.userId : undefined,
				});
				return next();
			},
		});
		const body = await callWhoami(handle);
		expect(JSON.stringify(body.result)).toContain("user_1");
		expect(calls).toEqual([{ tool: "whoami", input: {}, userId: "user_1" }]);
	});

	it("can deny a call with a caller-safe message (quota) without running the tool", async () => {
		let ran = false;
		const handle = createMcpEndpoint({
			name: "test",
			version: "0.0.0",
			auth: "optional",
			tools: [
				defineMcpTool({
					name: "counted",
					description: "Counted tool",
					access: "authenticated",
					input: z.object({}),
					handler: async () => {
						ran = true;
						return "ok";
					},
				}),
			],
			resolvePrincipal: async () => user,
			wrapTool: async () => {
				throw new McpToolError("Quota exceeded");
			},
		});
		const body = await readRpc(
			await handle(
				rpcRequest("tools/call", { name: "counted", arguments: {} }),
			),
		);
		expect(ran).toBe(false);
		expect(body.result?.isError).toBe(true);
		expect(JSON.stringify(body.result)).toContain("Quota exceeded");
	});

	it("sees the tool result and the tool's errors (auditing)", async () => {
		const outcomes: string[] = [];
		const handle = createMcpEndpoint({
			name: "test",
			version: "0.0.0",
			auth: "optional",
			tools: [
				...tools,
				defineMcpTool({
					name: "broken",
					description: "Always fails",
					access: "authenticated",
					input: z.object({}),
					handler: async () => {
						throw new McpToolError("Nope");
					},
				}),
			],
			resolvePrincipal: async () => user,
			wrapTool: async (call, next) => {
				try {
					const result = await next();
					outcomes.push(`${call.tool.name}:ok:${JSON.stringify(result)}`);
					return result;
				} catch (error) {
					outcomes.push(`${call.tool.name}:error`);
					throw error;
				}
			},
		});
		await callWhoami(handle);
		const broken = await readRpc(
			await handle(rpcRequest("tools/call", { name: "broken", arguments: {} })),
		);
		expect(outcomes).toEqual(['whoami:ok:{"userId":"user_1"}', "broken:error"]);
		expect(JSON.stringify(broken.result)).toContain("Nope");
	});

	it("reports unexpected hook errors as an internal error via onError", async () => {
		const errors: unknown[] = [];
		const handle = createMcpEndpoint({
			name: "test",
			version: "0.0.0",
			auth: "optional",
			tools,
			resolvePrincipal: async () => user,
			wrapTool: async () => {
				throw new Error("db down: secret detail");
			},
			onError: (error) => errors.push(error),
		});
		const body = await callWhoami(handle);
		expect(JSON.stringify(body.result)).toContain("Internal error");
		expect(JSON.stringify(body.result)).not.toContain("secret detail");
		expect(errors).toHaveLength(1);
	});
});
