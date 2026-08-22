import { deleteContact } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware, permissionProcedure } from "../../../orpc";
import { requireOrgPermissionAccess } from "../../organizations/shared";

const deleteContactSchema = z.object({
	id: z.string().min(1),
	organizationId: z.string().min(1),
});

export const deleteContactProcedure = permissionProcedure(
	PERMISSIONS.CRM.DELETE,
)
	.use(createRateLimitMiddleware({ endpoint: "crmContact" }))
	.route({
		method: "DELETE",
		path: "/crm/contacts/{id}",
		tags: ["CRM"],
		summary: "Delete contact",
		description: "Permanently deletes a contact from an organization.",
	})
	.input(deleteContactSchema)
	.handler(async ({ input, context }) => {
		await requireOrgPermissionAccess(
			input.organizationId,
			context.user.id,
			PERMISSIONS.CRM.DELETE,
			context.headers,
		);
		const result = await deleteContact(input.id, input.organizationId);
		if (!result) {
			throw new ORPCError("NOT_FOUND", { message: "Contact not found" });
		}
		return { success: true };
	});
