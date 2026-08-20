import { deleteApiKey, getApiKey } from "@fuutu/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware, permissionProcedure } from "../../../orpc";
import { requireOrgRole } from "../../organizations/shared";

const apiKeyIdSchema = z.object({
	id: z.string().uuid(),
});

export const deleteApiKeyProcedure = permissionProcedure("delete:api-key")
	.use(createRateLimitMiddleware({ endpoint: "apiKeyMutation" }))
	.route({
		method: "DELETE",
		path: "/api-keys/{id}",
		tags: ["API Keys"],
		summary: "Delete API key",
		description:
			"Permanently deletes an API key. Personal keys can only be deleted by the owner. Org-level keys require admin role in the organization.",
	})
	.input(apiKeyIdSchema)
	.handler(async ({ input, context }) => {
		const key = await getApiKey(input.id);
		if (!key) {
			throw new ORPCError("NOT_FOUND", { message: "API key not found" });
		}
		if (key.organizationId) {
			await requireOrgRole(
				key.organizationId,
				context.user.id,
				"admin",
				context.headers,
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
