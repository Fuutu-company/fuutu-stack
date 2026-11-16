/**
 * Better Auth stores role lists comma-separated ("admin,user", "owner").
 * Internal to the query modules — not re-exported from `@fuutu/db`.
 */

/** Prisma filter: the `role` column's list contains `role`. */
export const roleListMatches = (role: string) => ({
	OR: [
		{ role: { equals: role } },
		{ role: { startsWith: `${role},` } },
		{ role: { endsWith: `,${role}` } },
		{ role: { contains: `,${role},` } },
	],
});

/** True when the comma-separated `list` contains `role`. */
export const roleListIncludes = (
	list: string | null | undefined,
	role: string,
): boolean =>
	(list ?? "")
		.split(",")
		.map((part) => part.trim())
		.includes(role);
