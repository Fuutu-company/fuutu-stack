import { updateContact } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { authProcedure, createRateLimitMiddleware } from "../../../orpc";

const updateContactSchema = z.object({
	id: z.string().min(1),
	organizationId: z.string().min(1),
	name: z.string().min(1).max(200).optional(),
	email: z.string().email().optional(),
	company: z.string().max(200).optional(),
	phone: z.string().max(50).optional(),
	status: z.enum(["lead", "qualified", "proposal", "won", "lost"]).optional(),
	notes: z.string().max(5000).optional(),
});

export const updateContactProcedure = authProcedure({
	org: { permission: PERMISSIONS.CRM.UPDATE },
})
	.use(createRateLimitMiddleware({ endpoint: "crmContact" }))
	.route({
		method: "PATCH",
		path: "/crm/contacts/{id}",
		tags: ["CRM"],
		summary: "Update contact",
		description: "Updates a contact's fields within an organization.",
	})
	.input(updateContactSchema)
	.handler(async ({ input }) => {
		const { id, organizationId, ...data } = input;
		const result = await updateContact(id, organizationId, data);
		if (!result) {
			throw new ORPCError("NOT_FOUND", { message: "Contact not found" });
		}
		return result;
	});
