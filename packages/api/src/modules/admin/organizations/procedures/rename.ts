import { adminRenameOrganization } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../../orpc/middleware/rate-limit";
import { systemAdminProcedure } from "../../../../orpc/procedures";
import { recordAdminAction } from "../../audit";
import { reasonSchema } from "../../shared";
import {
	dispatchOrganizationEvent,
	loadTargetOrganization,
	organizationIdSchema,
} from "../shared";

const renameInput = z.object({
	organizationId: organizationIdSchema,
	name: z.string().trim().min(1).max(100),
	reason: reasonSchema.optional(),
});

export const renameOrganizationProcedure = systemAdminProcedure(
	PERMISSIONS.ADMIN_ORGANIZATION.UPDATE,
)
	.use(createRateLimitMiddleware({ endpoint: "adminMutation" }))
	.route({
		method: "PATCH",
		path: "/admin/organizations/{organizationId}",
		tags: ["Admin"],
		summary: "Rename organization",
		description:
			"Changes an organization's display name. The slug (its URL) never changes here. Sends the `organization.updated` webhook. System admin only.",
	})
	.input(renameInput)
	.handler(async ({ input, context }) => {
		const org = await loadTargetOrganization(input.organizationId);
		if (org.name === input.name) {
			return { success: true, changed: false, organization: org };
		}
		const organization = await adminRenameOrganization(org.id, input.name);
		await dispatchOrganizationEvent({
			event: "organization.updated",
			organizationId: org.id,
			payload: { organizationId: org.id, name: input.name },
		});
		await recordAdminAction(context, {
			action: "admin.org.rename",
			targetOrganizationId: org.id,
			reason: input.reason,
			changedFields: ["name"],
		});
		return { success: true, changed: true, organization };
	});
