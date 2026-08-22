import { getContact } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { permissionProcedure } from "../../../orpc";
import { requireOrgPermissionAccess } from "../../organizations/shared";

const getContactSchema = z.object({
	id: z.string().min(1),
	organizationId: z.string().min(1),
});

export const getContactProcedure = permissionProcedure(PERMISSIONS.CRM.VIEW)
	.route({
		method: "GET",
		path: "/crm/contacts/{id}",
		tags: ["CRM"],
		summary: "Get contact",
		description: "Returns a single contact by ID within an organization.",
	})
	.input(getContactSchema)
	.handler(async ({ input, context }) => {
		await requireOrgPermissionAccess(
			input.organizationId,
			context.user.id,
			PERMISSIONS.CRM.VIEW,
			context.headers,
		);
		const contact = await getContact(input.id, input.organizationId);
		if (!contact) {
			throw new ORPCError("NOT_FOUND", { message: "Contact not found" });
		}
		return contact;
	});
