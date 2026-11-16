import { deleteApiKey, getApiKey } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../orpc/middleware/rate-limit";
import {
	denyImpersonation,
	permissionProcedure,
} from "../../../orpc/procedures";
import { assertSessionCaller } from "../assert-session-caller";
import { requireOrgApiKeyManageAccess } from "../org-key-access";

const apiKeyIdSchema = z.object({
	id: z.string().min(1).max(64),
});

export const deleteApiKeyProcedure = permissionProcedure(
	PERMISSIONS.API_KEY.DELETE,
)
	.use(denyImpersonation)
	.use(createRateLimitMiddleware({ endpoint: "apiKeyMutation" }))
	.route({
		method: "DELETE",
		path: "/api-keys/{id}",
		tags: ["API Keys"],
		summary: "Delete API key",
		description:
			"Permanently deletes an API key. Personal keys can only be deleted by the owner. Org keys: an org admin or owner may delete any key of the organization, a member only the keys they created.",
	})
	.input(apiKeyIdSchema)
	.handler(async ({ input, context }) => {
		assertSessionCaller(context);
		const key = await getApiKey(input.id);
		if (!key) {
			throw new ORPCError("NOT_FOUND", { message: "API key not found" });
		}
		if (key.organizationId) {
			await requireOrgApiKeyManageAccess(
				{ organizationId: key.organizationId, userId: key.userId },
				context.user.id,
				context,
			);
			const result = await deleteApiKey(input.id, {
				organizationId: key.organizationId,
			});
			if (!result) {
				throw new ORPCError("NOT_FOUND", { message: "API key not found" });
			}
			return { success: true };
		}
		if (key.userId !== context.user.id) {
			throw new ORPCError("FORBIDDEN", { message: "Not the owner" });
		}
		const result = await deleteApiKey(input.id, { userId: context.user.id });
		if (!result) {
			throw new ORPCError("NOT_FOUND", { message: "API key not found" });
		}
		return { success: true };
	});
