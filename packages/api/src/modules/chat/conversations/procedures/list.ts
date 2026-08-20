import { countConversations, listConversations } from "@fuutu/db";
import { z } from "zod";
import { permissionProcedure } from "../../../../orpc";
import { requireOrgPermissionAccess } from "../../../organizations/shared";

const listConversationsSchema = z.object({
	organizationId: z.string().optional(),
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(100).default(50),
});

export const listConversationsProcedure = permissionProcedure("view:chat")
	.route({
		method: "GET",
		path: "/chat/conversations",
		tags: ["Chat"],
		summary: "List conversations",
		description:
			"Returns paginated chat conversations for the current user, optionally scoped to an organization.",
	})
	.input(listConversationsSchema)
	.handler(async ({ input, context }) => {
		if (input.organizationId) {
			await requireOrgPermissionAccess(
				input.organizationId,
				context.user.id,
				"view:chat",
				context.headers,
			);
		}
		const skip = (input.page - 1) * input.limit;
		const [items, total] = await Promise.all([
			listConversations(context.user.id, input.organizationId ?? null, {
				take: input.limit,
				skip,
			}),
			countConversations(context.user.id, input.organizationId ?? null),
		]);
		return {
			items,
			page: input.page,
			limit: input.limit,
			total,
			totalPages: Math.max(1, Math.ceil(total / input.limit)),
		};
	});
