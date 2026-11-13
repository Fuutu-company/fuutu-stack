/**
 * Merge app-provided extras into a kit-owned ordered list — the placement
 * rule behind the app extension points (sidebar items, onboarding steps).
 *
 * - `after: "<key>"` places the extra directly after that item; several
 *   extras on the same anchor keep their declaration order — each goes
 *   directly behind the previous extra placed on that anchor.
 * - No `after`, or an anchor that is not in the list (e.g. a kit item
 *   hidden by a feature flag), appends the extra at the end.
 * - An extra may anchor on an extra declared BEFORE it (one declared
 *   later is not in the list yet → appended). Chained extras do not move
 *   with their anchor's siblings: `[x after a, y after x, z after a]`
 *   gives `a, x, z, y` — z lands behind x, in front of x's chained y.
 * - A key that already exists throws — two items with one key would
 *   collide as React keys and as navigation targets.
 *
 * Returns a new array; `base` is not mutated.
 */
export function insertAfter<T>(
	base: readonly T[],
	extras: readonly { after?: string; item: T }[],
	keyOf: (item: T) => string,
): T[] {
	const result = [...base];
	const keys = new Set(result.map(keyOf));
	// anchor → key of the last extra placed after it, so later extras on the
	// same anchor land behind earlier ones.
	const lastPlaced = new Map<string, string>();

	for (const { after, item } of extras) {
		const itemKey = keyOf(item);
		if (keys.has(itemKey)) {
			throw new Error(`insertAfter: duplicate key "${itemKey}"`);
		}
		keys.add(itemKey);

		const anchor =
			after === undefined ? undefined : (lastPlaced.get(after) ?? after);
		const index =
			anchor === undefined ? -1 : result.findIndex((i) => keyOf(i) === anchor);
		if (after === undefined || index === -1) {
			result.push(item);
			continue;
		}
		result.splice(index + 1, 0, item);
		lastPlaced.set(after, itemKey);
	}
	return result;
}
