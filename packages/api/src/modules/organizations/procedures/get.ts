import { auth } from "@fuutu/auth";
import { getOrganizationBySlug } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { permissionProcedure } from "../../../orpc";
import { requireOrgPermissionAccess, slugSchema } from "../shared";

export const getOrganization = permissionProcedure(
	PERMISSIONS.ORGANIZATION.VIEW,
)
	.route({
		method: "GET",
		path: "/organizations/{slug}",
		tags: ["Organizations"],
		summary: "Get organization by slug",
		description: "Returns a single organization with members and invitations.",
	})
	.input(z.object({ slug: slugSchema }))
	.handler(async ({ input, context }) => {
		const org = await getOrganizationBySlug(input.slug);
		if (!org) {
			throw new ORPCError("NOT_FOUND", { message: "Organization not found" });
		}
		await requireOrgPermissionAccess(
			org.id,
			context.user.id,
			PERMISSIONS.ORGANIZATION.VIEW,
			context.headers,
		);
		const fullOrg = await auth.api.getFullOrganization({
			query: { organizationId: org.id },
			headers: context.headers,
		});
		if (!fullOrg) {
			throw new ORPCError("NOT_FOUND", { message: "Organization not found" });
		}
		return fullOrg;
	});
