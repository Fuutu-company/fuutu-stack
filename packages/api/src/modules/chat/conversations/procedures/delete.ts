import { deleteConversation } from "@fuutu/db";
import { ORPCError } from "@orpc/server";
import {
	createRateLimitMiddleware,
	permissionProcedure,
} from "../../../../orpc";
import { conversationIdSchema } from "../../shared";

export const deleteConversationProcedure = permissionProcedure("delete:chat")
	.use(createRateLimitMiddleware({ endpoint: "chatConversation" }))
	.route({
		method: "DELETE",
		path: "/chat/conversations/{conversationId}",
		tags: ["Chat"],
		summary: "Delete conversation",
		description:
			"Permanently deletes a chat conversation and all its messages. Only the owner can delete.",
	})
	.input(conversationIdSchema)
	.handler(async ({ input, context }) => {
		const result = await deleteConversation(
			input.conversationId,
			context.user.id,
		);
		if (!result) {
			throw new ORPCError("NOT_FOUND", {
				message: "Conversation not found",
			});
		}
		return { success: true };
	});
