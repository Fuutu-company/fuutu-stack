import { z } from "zod";
import { permissionProcedure } from "../../../../orpc";
import { requireOrgRole } from "../../shared";

const listMembersSchema = z.object({
	organizationId: z.string().min(1),
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(100).default(50),
});

export const listMembers = permissionProcedure("view:organization")
	.route({
		method: "GET",
		path: "/organizations/{organizationId}/members",
		tags: ["Organizations"],
		summary: "List organization members",
		description: "Returns paginated members of an organization.",
	})
	.input(listMembersSchema)
	.handler(async ({ input, context }) => {
		const org = await requireOrgRole(
			input.organizationId,
			context.user.id,
			"member",
			context.headers,
		);
		const members = org.members ?? [];
		const total = members.length;
		const skip = (input.page - 1) * input.limit;
		const items = members.slice(skip, skip + input.limit);
		return {
			items,
			page: input.page,
			limit: input.limit,
			total,
			totalPages: Math.max(1, Math.ceil(total / input.limit)),
		};
	});
