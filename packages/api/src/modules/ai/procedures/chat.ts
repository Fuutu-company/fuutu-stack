import { resolveAIProvider } from "@fuutu/ai";
import { PERMISSIONS } from "@fuutu/rbac";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../orpc/middleware/rate-limit";
import { permissionProcedure } from "../../../orpc/procedures";

const chatInputSchema = z.object({
	messages: z
		.array(
			z.object({
				role: z.enum(["user", "assistant", "system"]),
				content: z.string().min(1).max(10000),
			}),
		)
		.min(1)
		.max(50),
});

export const chat = permissionProcedure(PERMISSIONS.USE_AI)
	.use(createRateLimitMiddleware({ endpoint: "aiChat" }))
	.route({
		method: "POST",
		path: "/ai/chat",
		tags: ["AI"],
		summary: "Chat with AI",
		description: "Send messages to AI and receive streaming responses",
	})
	.input(chatInputSchema)
	.handler(async ({ input }) => {
		const provider = resolveAIProvider();
		const stream = await provider.stream(input.messages);
		return new Response(stream, {
			headers: {
				// Providers yield raw UTF-8 text chunks, not SSE frames.
				"content-type": "text/plain; charset=utf-8",
				"cache-control": "no-cache",
			},
		});
	});
