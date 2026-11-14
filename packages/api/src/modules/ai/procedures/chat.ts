import { randomUUID } from "node:crypto";
import { resolveAIProvider } from "@fuutu/ai";
import { createLogger } from "@fuutu/logs";
import { PERMISSIONS } from "@fuutu/rbac";
import { eventIterator } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../orpc/middleware/rate-limit";
import { permissionProcedure } from "../../../orpc/procedures";
import { assertAiCredits, estimateTokens, recordAiUsage } from "../metering";
import { textChunks } from "../text-chunks";

const log = createLogger({ scope: "ai-chat" });

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
		description:
			"Send messages to AI and receive streaming responses. Event stream: one `message` event per text chunk (JSON string data), then `done`. Billed to the caller on the `ai_tokens` credit meter; 402 when the meter blocks.",
	})
	.input(chatInputSchema)
	.output(eventIterator(z.string()))
	.handler(async ({ input, context }) => {
		const owner = { userId: context.user.id };
		const promptTokens = estimateTokens(
			input.messages.map((m) => m.content).join(""),
		);
		await assertAiCredits(owner, promptTokens);

		const provider = resolveAIProvider();
		const stream = await provider.stream(input.messages);
		// Stateless: one consume per request.
		const idempotencyKey = `ai-chat:${randomUUID()}`;

		// Text chunks as an event stream (oRPC serialises the generator);
		// billed once it ends — also partially on an error or disconnect.
		async function* reply(): AsyncGenerator<string, void, undefined> {
			let fullResponse = "";
			try {
				for await (const chunk of textChunks(stream)) {
					fullResponse += chunk;
					yield chunk;
				}
			} catch (error) {
				log.error("Stream pump failed", { err: error });
				throw error;
			} finally {
				await recordAiUsage(owner, {
					promptTokens,
					reply: fullResponse,
					idempotencyKey,
					reason: "ai.chat",
				});
			}
		}

		return reply();
	});
