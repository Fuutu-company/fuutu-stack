import { countMessages, listMessages } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { permissionProcedure } from "../../../../orpc/procedures";
import { conversationIdSchema } from "../../shared";

const listMessagesSchema = conversationIdSchema.extend({
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(100).default(50),
});

export const listMessagesProcedure = permissionProcedure(PERMISSIONS.CHAT.VIEW)
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
		const skip = (input.page - 1) * input.limit;
		// Both queries enforce ownership themselves and return null for a
		// missing or foreign conversation — no separate check needed.
		const [items, total] = await Promise.all([
			listMessages(input.conversationId, context.user.id, {
				take: input.limit,
				skip,
			}),
			countMessages(input.conversationId, context.user.id),
		]);
		if (items === null || total === null) {
			throw new ORPCError("NOT_FOUND", {
				message: "Conversation not found",
			});
		}
		return {
			items,
			page: input.page,
			limit: input.limit,
			total,
			totalPages: Math.max(1, Math.ceil(total / input.limit)),
		};
	});
