import {
	countApiKeys,
	countOrgApiKeys,
	listApiKeys,
	listOrgApiKeys,
} from "@fuutu/db";
import { z } from "zod";
import { permissionProcedure } from "../../../orpc";
import { requireOrgPermissionAccess } from "../../organizations/shared";

const listApiKeysSchema = z.object({
	organizationId: z.string().optional(),
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(100).default(50),
});

export const listApiKeysProcedure = permissionProcedure("view:api-key")
	.route({
		method: "GET",
		path: "/api-keys",
		tags: ["API Keys"],
		summary: "List API keys",
		description:
			"Returns paginated API keys for the current user or a specific organization.",
	})
	.input(listApiKeysSchema)
	.handler(async ({ input, context }) => {
		const skip = (input.page - 1) * input.limit;
		if (input.organizationId) {
			await requireOrgPermissionAccess(
				input.organizationId,
				context.user.id,
				"view:api-key",
				context.headers,
			);
			const [items, total] = await Promise.all([
				listOrgApiKeys(input.organizationId, {
					take: input.limit,
					skip,
				}),
				countOrgApiKeys(input.organizationId),
			]);
			return {
				items,
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
			}),
			countApiKeys(context.user.id),
		]);
		return {
			items,
			page: input.page,
			limit: input.limit,
			total,
			totalPages: Math.max(1, Math.ceil(total / input.limit)),
		};
	});
