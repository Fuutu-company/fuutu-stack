import {
	getCreditPackagesForOrganization,
	getCreditPackagesForUser,
} from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";

import { z } from "zod";
import { permissionProcedure } from "../../../orpc";
import { requireOrgPermissionAccess } from "../../organizations/shared";

const packagesSchema = z.object({
	organizationId: z.string().uuid().optional(),
});

export const getPackages = permissionProcedure(PERMISSIONS.CREDIT.VIEW)
	.route({
		method: "GET",
		path: "/credits/packages",
		tags: ["Credits"],
		summary: "Get credit top-up packages",
		description:
			"Returns all top-up packages (active and expired) for the current user or organization.",
	})
	.input(packagesSchema)
	.handler(async ({ input, context }) => {
		if (input.organizationId) {
			await requireOrgPermissionAccess(
				input.organizationId,
				context.user.id,
				PERMISSIONS.CREDIT.VIEW,
				context.headers,
			);
		}
		const packages = input.organizationId
			? await getCreditPackagesForOrganization(input.organizationId)
			: await getCreditPackagesForUser(context.user.id);
		return { packages };
	});
