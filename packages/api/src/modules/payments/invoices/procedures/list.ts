import {
	countInvoicesByOrg,
	countInvoicesByUser,
	listInvoicesByOrg,
	listInvoicesByUser,
} from "@fuutu/db";
import { z } from "zod";
import { protectedProcedure } from "../../../../orpc";
import { requireOrgRole } from "../../../organizations/shared";

const invoicesListSchema = z.object({
	organizationId: z.string().optional(),
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(100).default(50),
});

export const listInvoices = protectedProcedure
	.route({
		method: "GET",
		path: "/payments/invoices",
		tags: ["Payments"],
		summary: "List invoices",
		description: "Returns paginated invoices for the user or organization.",
	})
	.input(invoicesListSchema)
	.handler(async ({ input, context }) => {
		const skip = (input.page - 1) * input.limit;
		if (input.organizationId) {
			await requireOrgRole(
				input.organizationId,
				context.user.id,
				"member",
				context.headers,
			);
			const [items, total] = await Promise.all([
				listInvoicesByOrg(input.organizationId, {
					take: input.limit,
					skip,
				}),
				countInvoicesByOrg(input.organizationId),
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
			listInvoicesByUser(context.user.id, {
				take: input.limit,
				skip,
			}),
			countInvoicesByUser(context.user.id),
		]);
		return {
			items,
			page: input.page,
			limit: input.limit,
			total,
			totalPages: Math.max(1, Math.ceil(total / input.limit)),
		};
	});
