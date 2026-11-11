import type { z } from "zod";

/** An authenticated MCP caller, resolved server-side from its credential. */
export type McpUserPrincipal = {
	kind: "user";
	/** How the credential was verified. */
	via: "api-key" | "oauth";
	/** Id of the API key / OAuth token — for audit + rate limiting. */
	credentialId: string;
	userId: string;
	organizationId: string | null;
	/** Role inside `organizationId` (Better Auth member role), if any. */
	orgRole: string | null;
	/** System-wide role (Better Auth admin plugin `user.role`). */
	systemRole: string | null;
	/** Scopes granted to the credential. */
	scopes: readonly string[];
};

export type McpPrincipal = { kind: "anonymous" } | McpUserPrincipal;

/**
 * Who may see and call a tool / prompt.
 * - `"public"`: everyone, including anonymous callers
 * - `"authenticated"`: any verified credential
 * - predicate: verified credential + custom rule (role, scope, org, …)
 */
export type McpAccess =
	| "public"
	| "authenticated"
	| ((principal: McpUserPrincipal) => boolean);

export type McpContext<A extends McpAccess> = {
	principal: A extends "public" ? McpPrincipal : McpUserPrincipal;
	/** The incoming HTTP request (headers, URL). */
	request: Request;
};

export type McpToolAnnotations = {
	readOnlyHint?: boolean;
	destructiveHint?: boolean;
	idempotentHint?: boolean;
	openWorldHint?: boolean;
};

export type McpToolDefinition<
	I extends z.ZodObject = z.ZodObject,
	A extends McpAccess = McpAccess,
> = {
	/** snake_case, unique per endpoint. */
	name: string;
	title?: string;
	/** Shown to the model — say what it does and when to use it. */
	description: string;
	access: A;
	input: I;
	annotations?: McpToolAnnotations;
	/** Return JSON-serialisable data or a plain string. Throw to signal a tool error. */
	handler: (input: z.infer<I>, ctx: McpContext<A>) => Promise<unknown>;
};

export type McpPromptDefinition<
	I extends z.ZodObject = z.ZodObject,
	A extends McpAccess = McpAccess,
> = {
	name: string;
	title?: string;
	description: string;
	access: A;
	args?: I;
	/** Returns the prompt text sent to the model as a user message. */
	render: (args: z.infer<I>, ctx: McpContext<A>) => string | Promise<string>;
};

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous registries need erased generics; definitions stay fully typed via defineMcpTool/defineMcpPrompt.
export type AnyMcpTool = McpToolDefinition<any, any>;
// biome-ignore lint/suspicious/noExplicitAny: see AnyMcpTool.
export type AnyMcpPrompt = McpPromptDefinition<any, any>;
