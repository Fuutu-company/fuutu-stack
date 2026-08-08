import { createConversation } from "@fuutu/db";
import { z } from "zod";
import {
	createRateLimitMiddleware,
	protectedProcedure,
} from "../../../../orpc";
import { requireOrgRole } from "../../../organizations/shared";

const createConversationSchema = z.object({
	title: z.string().min(1).max(200).optional(),
	organizationId: z.string().optional(),
});

export const createConversationProcedure = protectedProcedure
	.use(createRateLimitMiddleware({ endpoint: "chatConversation" }))
	.route({
		method: "POST",
		path: "/chat/conversations",
		tags: ["Chat"],
		summary: "Create conversation",
		description:
			"Creates a new chat conversation, optionally scoped to an organization.",
	})
	.input(createConversationSchema)
	.handler(async ({ input, context }) => {
		if (input.organizationId) {
			await requireOrgRole(
				input.organizationId,
				context.user.id,
				"member",
				context.headers,
			);
		}
		const conversation = await createConversation(
			context.user.id,
			input.organizationId ?? null,
			input.title,
		);
		return conversation;
	});
