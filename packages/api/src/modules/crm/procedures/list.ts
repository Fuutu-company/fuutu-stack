import { countContacts, listContacts } from "@fuutu/db";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc";
import { requireOrgRole } from "../../organizations/shared";

const listContactsSchema = z.object({
	organizationId: z.string().min(1),
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(100).default(50),
	status: z.enum(["lead", "qualified", "proposal", "won", "lost"]).optional(),
	search: z.string().optional(),
});

export const listContactsProcedure = protectedProcedure
	.route({
		method: "GET",
		path: "/crm/contacts",
		tags: ["CRM"],
		summary: "List contacts",
		description:
			"Returns paginated contacts for an organization, optionally filtered by status or search term.",
	})
	.input(listContactsSchema)
	.handler(async ({ input, context }) => {
		await requireOrgRole(
			input.organizationId,
			context.user.id,
			"member",
			context.headers,
		);
		const skip = (input.page - 1) * input.limit;
		const items = await listContacts(input.organizationId, {
			take: input.limit,
			skip,
			...(input.status ? { status: input.status } : {}),
			...(input.search ? { search: input.search } : {}),
		});
		const total = await countContacts(input.organizationId, {
			...(input.status ? { status: input.status } : {}),
			...(input.search ? { search: input.search } : {}),
		});
		return {
			items,
			page: input.page,
			limit: input.limit,
			total,
			totalPages: Math.max(1, Math.ceil(total / input.limit)),
		};
	});
