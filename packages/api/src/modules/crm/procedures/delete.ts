import { deleteContact } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { authProcedure, createRateLimitMiddleware } from "../../../orpc";

const deleteContactSchema = z.object({
	id: z.string().min(1),
	organizationId: z.string().min(1),
});

export const deleteContactProcedure = authProcedure({
	org: { permission: PERMISSIONS.CRM.DELETE },
})
	.use(createRateLimitMiddleware({ endpoint: "crmContact" }))
	.route({
		method: "DELETE",
		path: "/crm/contacts/{id}",
		tags: ["CRM"],
		summary: "Delete contact",
		description: "Permanently deletes a contact from an organization.",
	})
	.input(deleteContactSchema)
	.handler(async ({ input }) => {
		const result = await deleteContact(input.id, input.organizationId);
		if (!result) {
			throw new ORPCError("NOT_FOUND", { message: "Contact not found" });
		}
		return { success: true };
	});
