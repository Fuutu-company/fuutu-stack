import { resolveAIProvider } from "@fuutu/ai";
import { aiConfig } from "@fuutu/ai/config";
import { addMessage, getConversation } from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { PERMISSIONS } from "@fuutu/rbac";
import { eventIterator, ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../../orpc/middleware/rate-limit";
import {
	denyImpersonation,
	permissionProcedure,
} from "../../../../orpc/procedures";
import {
	type AiCreditOwner,
	assertAiCredits,
	estimateTokens,
	recordAiUsage,
} from "../../../ai/metering";
import { textChunks } from "../../../ai/text-chunks";
import { requireConversationOrgAccess } from "../../conversation-access";

const log = createLogger({ scope: "chat-stream" });

const VALID_ROLES = ["user", "assistant", "system"] as const;
type ValidRole = (typeof VALID_ROLES)[number];

const streamMessageSchema = z.object({
	conversationId: z.string().min(1),
	content: z.string().min(1).max(10000),
});

export const streamMessageProcedure = permissionProcedure(PERMISSIONS.USE_AI)
	.use(denyImpersonation)
	.use(createRateLimitMiddleware({ endpoint: "aiChat" }))
	.route({
		method: "POST",
		path: "/chat/messages/stream",
		tags: ["Chat"],
		summary: "Stream AI response",
		description:
			"Saves the user message, streams the AI response, and saves the full AI response after streaming completes. Event stream: one `message` event per text chunk (JSON string data), then `done`. An org conversation requires current membership of the organization. Billed on the `ai_tokens` credit meter (the conversation's organization, else the user); 402 when the meter blocks.",
	})
	.input(streamMessageSchema)
	.output(eventIterator(z.string()))
	.handler(async ({ input, context }) => {
		const conversation = await getConversation(
			input.conversationId,
			context.user.id,
			{ take: 50 },
		);
		if (!conversation) {
			throw new ORPCError("NOT_FOUND", {
				message: "Conversation not found",
			});
		}
		// Before anything is saved, sent to the provider or billed to the org.
		await requireConversationOrgAccess(
			conversation,
			context.user.id,
			PERMISSIONS.CHAT.CREATE,
			context,
		);

		// getConversation returned the newest 50 messages descending. Keep
		// the newest ones that fit the prompt cap next to the new message,
		// then reverse back to chronological order for the provider.
		let historyBudget = aiConfig.maxPromptChars - input.content.length;
		const newestFirst = [];
		for (const m of conversation.messages) {
			historyBudget -= m.content.length;
			if (historyBudget < 0) break;
			newestFirst.push(m);
		}
		const history = newestFirst
			.reverse()
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

		const owner: AiCreditOwner = conversation.organizationId
			? { organizationId: conversation.organizationId }
			: { userId: context.user.id };
		const promptTokens = estimateTokens(
			messages.map((m) => m.content).join(""),
		);
		const spend = await assertAiCredits(owner, promptTokens);

		const userMessage = await addMessage(
			input.conversationId,
			context.user.id,
			"user",
			input.content,
		);
		if (!userMessage) {
			throw new ORPCError("NOT_FOUND", {
				message: "Conversation not found",
			});
		}

		const provider = resolveAIProvider();
		const stream = await provider.stream(messages);

		const conversationId = input.conversationId;
		const userId = context.user.id;
		const userMessageId = userMessage.id;

		// An async generator: oRPC sends it as an event stream (one text
		// chunk per event). The reply is saved and billed once the stream
		// ends — also partially when it fails or the client disconnects.
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
				if (fullResponse) {
					try {
						await addMessage(conversationId, userId, "assistant", fullResponse);
					} catch (err) {
						log.error("Failed to save assistant message", { err });
					}
				}
				await recordAiUsage(owner, {
					promptTokens,
					reply: fullResponse,
					idempotencyKey: `chat-reply:${userMessageId}`,
					reason: "chat.messages.stream",
					spend,
				});
			}
		}

		return reply();
	});
