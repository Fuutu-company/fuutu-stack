import { createContact } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { z } from "zod";
import { authProcedure, createRateLimitMiddleware } from "../../../orpc";

const createContactSchema = z.object({
	organizationId: z.string().min(1),
	name: z.string().min(1).max(200),
	email: z.string().email(),
	company: z.string().max(200).optional(),
	phone: z.string().max(50).optional(),
	status: z
		.enum(["lead", "qualified", "proposal", "won", "lost"])
		.default("lead"),
	notes: z.string().max(5000).optional(),
});

export const createContactProcedure = authProcedure({
	org: { permission: PERMISSIONS.CRM.CREATE },
})
	.use(createRateLimitMiddleware({ endpoint: "crmContact" }))
	.route({
		method: "POST",
		path: "/crm/contacts",
		tags: ["CRM"],
		summary: "Create contact",
		description: "Creates a new contact in the specified organization.",
	})
	.input(createContactSchema)
	.handler(async ({ input }) => {
		const contact = await createContact({
			organizationId: input.organizationId,
			name: input.name,
			email: input.email,
			company: input.company ?? null,
			phone: input.phone ?? null,
			status: input.status,
			notes: input.notes ?? null,
		});
		return contact;
	});
