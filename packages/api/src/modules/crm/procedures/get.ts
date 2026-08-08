import { getContact } from "@fuutu/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc";
import { requireOrgRole } from "../../organizations/shared";

const getContactSchema = z.object({
	id: z.string().min(1),
	organizationId: z.string().min(1),
});

export const getContactProcedure = protectedProcedure
	.route({
		method: "GET",
		path: "/crm/contacts/{id}",
		tags: ["CRM"],
		summary: "Get contact",
		description: "Returns a single contact by ID within an organization.",
	})
	.input(getContactSchema)
	.handler(async ({ input, context }) => {
		await requireOrgRole(
			input.organizationId,
			context.user.id,
			"member",
			context.headers,
		);
		const contact = await getContact(input.id, input.organizationId);
		if (!contact) {
			throw new ORPCError("NOT_FOUND", { message: "Contact not found" });
		}
		return contact;
	});
