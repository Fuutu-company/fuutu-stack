import { resolveAIProvider } from "@fuutu/ai";
import { addMessage, getConversation } from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import {
	createRateLimitMiddleware,
	permissionProcedure,
} from "../../../../orpc";

const log = createLogger({ scope: "chat-stream" });

const VALID_ROLES = ["user", "assistant", "system"] as const;
type ValidRole = (typeof VALID_ROLES)[number];

const streamMessageSchema = z.object({
	conversationId: z.string().min(1),
	content: z.string().min(1).max(10000),
});

export const streamMessageProcedure = permissionProcedure(PERMISSIONS.CHAT.VIEW)
	.use(createRateLimitMiddleware({ endpoint: "aiChat" }))
	.route({
		method: "POST",
		path: "/chat/messages/stream",
		tags: ["Chat"],
		summary: "Stream AI response",
		description:
			"Saves the user message, streams the AI response, and saves the full AI response after streaming completes.",
	})
	.input(streamMessageSchema)
	.handler(async ({ input, context }) => {
		const conversation = await getConversation(
			input.conversationId,
			context.user.id,
		);
		if (!conversation) {
			throw new ORPCError("NOT_FOUND", {
				message: "Conversation not found",
			});
		}

		await addMessage(
			input.conversationId,
			context.user.id,
			"user",
			input.content,
		);

		const history = conversation.messages
			.filter((m) => {
				if (!VALID_ROLES.includes(m.role as ValidRole)) {
					log.warn("Skipping message with invalid role", {
						role: m.role,
					});
					return false;
				}
				return true;
			})
			.map((m) => ({
				role: m.role as ValidRole,
				content: m.content,
			}));

		const messages = [
			...history,
			{ role: "user" as const, content: input.content },
		];

		const provider = resolveAIProvider();
		const stream = await provider.stream(messages);

		let fullResponse = "";

		const transformedStream = new ReadableStream<Uint8Array>({
			start(controller) {
				const reader = stream.getReader();
				const decoder = new TextDecoder();
				async function pump(): Promise<void> {
					try {
						const { done, value } = await reader.read();
						if (done) {
							const flushed = decoder.decode();
							if (flushed) {
								fullResponse += flushed;
							}
							controller.close();
							if (fullResponse) {
								try {
									await addMessage(
										input.conversationId,
										context.user.id,
										"assistant",
										fullResponse,
									);
								} catch (err) {
									log.error(
										"Failed to save assistant message on stream close",
										{ err },
									);
								}
							}
							return;
						}
						const chunk = decoder.decode(value, { stream: true });
						fullResponse += chunk;
						controller.enqueue(value);
						await pump();
					} catch (error) {
						log.error("Stream pump failed", { err: error });
						if (fullResponse) {
							try {
								await addMessage(
									input.conversationId,
									context.user.id,
									"assistant",
									fullResponse,
								);
							} catch (err) {
								log.error("Failed to save assistant message on stream error", {
									err,
								});
							}
						}
						controller.error(error);
					}
				}
				void pump();
			},
		});

		return new Response(transformedStream, {
			headers: {
				"content-type": "text/event-stream",
				"cache-control": "no-cache",
				connection: "keep-alive",
			},
		});
	});
