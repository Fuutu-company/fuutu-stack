import { deleteConversation } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { createRateLimitMiddleware } from "../../../../orpc/middleware/rate-limit";
import { permissionProcedure } from "../../../../orpc/procedures";
import { requireConversationAccess } from "../../conversation-access";
import { conversationIdSchema } from "../../shared";

export const deleteConversationProcedure = permissionProcedure(
	PERMISSIONS.CHAT.DELETE,
)
	.use(createRateLimitMiddleware({ endpoint: "chatConversation" }))
	.route({
		method: "DELETE",
		path: "/chat/conversations/{conversationId}",
		tags: ["Chat"],
		summary: "Delete conversation",
		description:
			"Permanently deletes a chat conversation and all its messages. Only the owner can delete; an org conversation also requires current membership of the organization.",
	})
	.input(conversationIdSchema)
	.handler(async ({ input, context }) => {
		await requireConversationAccess(
			input.conversationId,
			context.user.id,
			PERMISSIONS.CHAT.DELETE,
			context,
		);
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
