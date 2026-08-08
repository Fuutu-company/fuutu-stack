import { getApiKey, revokeApiKey } from "@fuutu/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware, protectedProcedure } from "../../../orpc";
import { requireOrgRole } from "../../organizations/shared";

const apiKeyIdSchema = z.object({
	id: z.string().uuid(),
});

export const revokeApiKeyProcedure = protectedProcedure
	.use(createRateLimitMiddleware({ endpoint: "apiKeyMutation" }))
	.route({
		method: "POST",
		path: "/api-keys/{id}/revoke",
		tags: ["API Keys"],
		summary: "Revoke API key",
		description:
			"Revokes an API key. Personal keys can only be revoked by the owner. Org-level keys require admin role in the organization.",
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
			const result = await revokeApiKey(input.id, {
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
		const result = await revokeApiKey(input.id, { userId: context.user.id });
		if (!result) {
			throw new ORPCError("NOT_FOUND", { message: "API key not found" });
		}
		return { success: true };
	});
