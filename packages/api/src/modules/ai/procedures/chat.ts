import { resolveAIProvider } from "@fuutu/ai";
import { z } from "zod";
import { createRateLimitMiddleware, protectedProcedure } from "../../../orpc";

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

export const chat = protectedProcedure
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
				"content-type": "text/event-stream",
				"cache-control": "no-cache",
				connection: "keep-alive",
			},
		});
	});
