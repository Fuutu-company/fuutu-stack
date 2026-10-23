import { db } from "../client";

export const getActiveCreditPackages = (params: {
	userId?: string;
	organizationId?: string;
	meterKey: string;
}) =>
	db.creditPackage
		.findMany({
			where: {
				AND: [
					{
						// AND both owner columns — an OR with `?? null` matches
						// IS NULL rows and leaks the other owner's packages.
						userId: params.userId ?? null,
						organizationId: params.organizationId ?? null,
					},
					{ meterKey: params.meterKey },
					{
						OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
					},
				],
			},
			orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
		})
		.then((packages) => packages.filter((p) => p.amount - p.consumed > 0));

export const getCreditPackagesForUser = (userId: string) =>
	db.creditPackage.findMany({
		where: { userId },
		orderBy: { createdAt: "desc" },
	});

export const getCreditPackagesForOrganization = (organizationId: string) =>
	db.creditPackage.findMany({
		where: { organizationId },
		orderBy: { createdAt: "desc" },
	});
