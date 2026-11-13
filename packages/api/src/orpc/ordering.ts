type Orderable = { id?: string; createdAt?: Date | string | null };

function time(value: Date | string | null | undefined): number {
	return value ? new Date(value).getTime() : 0;
}

/**
 * Total order for lists that come from Better Auth without `orderBy`:
 * `createdAt` in the given direction, ties broken by `id` ascending —
 * stable across calls and across databases.
 */
export function sortByCreatedAt<T extends Orderable>(
	items: readonly T[],
	direction: "asc" | "desc",
): T[] {
	const sign = direction === "asc" ? 1 : -1;
	return [...items].sort(
		(a, b) =>
			sign * (time(a.createdAt) - time(b.createdAt)) ||
			(a.id ?? "").localeCompare(b.id ?? ""),
	);
}
