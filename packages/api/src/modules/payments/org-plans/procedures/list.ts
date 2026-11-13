import { auth } from "@fuutu/auth";
import { getOrgEntitlement } from "@fuutu/payments";
import { PERMISSIONS } from "@fuutu/rbac";
import { z } from "zod";
import { permissionProcedure } from "../../../../orpc/procedures";

/**
 * Plan of every organization the caller belongs to, resolved through the
 * same entitlement path the API gates use (`getOrgEntitlement`, honoring a
 * registered resolver) — one request for the org switcher instead of one
 * per org.
 */
export const listOrgPlans = permissionProcedure(PERMISSIONS.ORGANIZATION.VIEW)
	.route({
		method: "GET",
		path: "/payments/org-plans",
		tags: ["Payments"],
		summary: "List organization plans",
		description:
			"Returns the resolved plan ID of every organization the current user belongs to.",
	})
	.input(z.object({}).optional())
	.handler(async ({ context }) => {
		const orgs = await auth.api.listOrganizations({
			headers: context.headers,
		});
		const items = await Promise.all(
			orgs.map(async (org) => ({
				organizationId: org.id,
				planId: (await getOrgEntitlement(org.id)).planId,
			})),
		);
		return { items };
	});
