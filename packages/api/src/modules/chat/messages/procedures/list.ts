import { countMessages, getConversation, listMessages } from "@fuutu/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { protectedProcedure } from "../../../../orpc";
import { conversationIdSchema } from "../../shared";

const listMessagesSchema = conversationIdSchema.extend({
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(100).default(50),
});

export const listMessagesProcedure = protectedProcedure
	.route({
		method: "GET",
		path: "/chat/conversations/{conversationId}/messages",
		tags: ["Chat"],
		summary: "List messages",
		description:
			"Returns paginated messages in a conversation. Only the conversation owner can access.",
	})
	.input(listMessagesSchema)
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
		const skip = (input.page - 1) * input.limit;
		const [items, total] = await Promise.all([
			listMessages(input.conversationId, context.user.id, {
				take: input.limit,
				skip,
			}),
			countMessages(input.conversationId),
		]);
		return {
			items: items ?? [],
			page: input.page,
			limit: input.limit,
			total,
			totalPages: Math.max(1, Math.ceil(total / input.limit)),
		};
	});
