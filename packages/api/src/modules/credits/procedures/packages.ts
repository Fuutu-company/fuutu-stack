import {
	getCreditPackagesForOrganization,
	getCreditPackagesForUser,
} from "@fuutu/db";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc";
import { requireOrgRole } from "../../organizations/shared";

const packagesSchema = z.object({
	organizationId: z.string().optional(),
});

export const getPackages = protectedProcedure
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
			await requireOrgRole(
				input.organizationId,
				context.user.id,
				"member",
				context.headers,
			);
		}
		const packages = input.organizationId
			? await getCreditPackagesForOrganization(input.organizationId)
			: await getCreditPackagesForUser(context.user.id);
		return { packages };
	});
