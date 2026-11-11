import type { z } from "zod";
import type {
	McpAccess,
	McpPrincipal,
	McpPromptDefinition,
	McpToolDefinition,
} from "./types";

/** Typed identity helper — infers handler input + principal from the definition. */
export function defineMcpTool<I extends z.ZodObject, A extends McpAccess>(
	tool: McpToolDefinition<I, A>,
): McpToolDefinition<I, A> {
	return tool;
}

/** Typed identity helper for prompts (prompts surface as slash commands in most clients). */
export function defineMcpPrompt<
	A extends McpAccess,
	I extends z.ZodObject = z.ZodObject,
>(prompt: McpPromptDefinition<I, A>): McpPromptDefinition<I, A> {
	return prompt;
}

export function canAccess(access: McpAccess, principal: McpPrincipal): boolean {
	if (access === "public") return true;
	if (principal.kind !== "user") return false;
	if (access === "authenticated") return true;
	return access(principal);
}
