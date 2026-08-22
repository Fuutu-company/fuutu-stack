import { createConversation } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { z } from "zod";
import {
	createRateLimitMiddleware,
	permissionProcedure,
} from "../../../../orpc";
import { requireOrgPermissionAccess } from "../../../organizations/shared";

const createConversationSchema = z.object({
	title: z.string().min(1).max(200).optional(),
	organizationId: z.string().optional(),
});

export const createConversationProcedure = permissionProcedure(
	PERMISSIONS.CHAT.CREATE,
)
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
			await requireOrgPermissionAccess(
				input.organizationId,
				context.user.id,
				PERMISSIONS.CHAT.CREATE,
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
