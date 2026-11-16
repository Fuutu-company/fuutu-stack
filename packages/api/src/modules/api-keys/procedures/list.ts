import {
	countApiKeys,
	countOrgApiKeys,
	listApiKeys,
	listOrgApiKeys,
} from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";

import { z } from "zod";
import { apiConfig } from "../../../config";
import { authProcedure } from "../../../orpc/procedures";
import { canManageOrgApiKey } from "../org-key-access";

const listApiKeysSchema = z.object({
	organizationId: z.string().optional(),
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(50),
	/** Only keys carrying this scope (e.g. the MCP keys of an org). */
	scope: z.enum(apiConfig.apiKeyScopes).optional(),
});

export const listApiKeysProcedure = authProcedure({
	systemPermission: PERMISSIONS.API_KEY.VIEW,
	org: { permission: PERMISSIONS.API_KEY.VIEW, optional: true },
})
	.route({
		method: "GET",
		path: "/api-keys",
		tags: ["API Keys"],
		summary: "List API keys",
		description:
			"Returns paginated API keys for the current user or a specific organization. `canRevoke` says whether the caller may revoke the key.",
	})
	.input(listApiKeysSchema)
	.handler(async ({ input, context }) => {
		const skip = (input.page - 1) * input.limit;
		if (context.org) {
			const [items, total] = await Promise.all([
				listOrgApiKeys(context.org.id, {
					take: input.limit,
					skip,
					...(input.scope ? { scope: input.scope } : {}),
				}),
				countOrgApiKeys(
					context.org.id,
					input.scope ? { scope: input.scope } : {},
				),
			]);
			const member = context.membership;
			return {
				// What apiKeys.revoke would allow — the UI hides the action otherwise.
				items: items.map((item) => ({
					...item,
					canRevoke: member ? canManageOrgApiKey(member, item) : false,
				})),
				page: input.page,
				limit: input.limit,
				total,
				totalPages: Math.max(1, Math.ceil(total / input.limit)),
			};
		}
		const [items, total] = await Promise.all([
			listApiKeys(context.user.id, {
				take: input.limit,
				skip,
				...(input.scope ? { scope: input.scope } : {}),
			}),
			countApiKeys(context.user.id, input.scope ? { scope: input.scope } : {}),
		]);
		return {
			// The caller's own keys (org keys they created included — the
			// creator may revoke those while still a member).
			items: items.map((item) => ({ ...item, canRevoke: true })),
			page: input.page,
			limit: input.limit,
			total,
			totalPages: Math.max(1, Math.ceil(total / input.limit)),
		};
	});
