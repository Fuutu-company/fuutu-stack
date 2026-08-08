import { createApiKey } from "@fuutu/db";
import { z } from "zod";
import { createRateLimitMiddleware, protectedProcedure } from "../../../orpc";
import { requireOrgRole } from "../../organizations/shared";

const createApiKeySchema = z.object({
	name: z.string().min(1).max(100),
	organizationId: z.string().optional(),
	expiresAt: z.coerce.date().optional(),
});

export const createApiKeyProcedure = protectedProcedure
	.use(createRateLimitMiddleware({ endpoint: "apiKeyMutation" }))
	.route({
		method: "POST",
		path: "/api-keys",
		tags: ["API Keys"],
		summary: "Create API key",
		description:
			"Creates a new API key. The plaintext key is returned only once.",
	})
	.input(createApiKeySchema)
	.handler(async ({ input, context }) => {
		if (input.organizationId) {
			await requireOrgRole(
				input.organizationId,
				context.user.id,
				"admin",
				context.headers,
			);
		}
		const result = await createApiKey(
			context.user.id,
			input.name,
			input.organizationId ?? null,
			input.expiresAt ?? null,
		);
		return result;
	});
