import { insertAfter } from "@fuutu/utils/insert-after";
import type { AppHomeSections, HomeSection } from "../../../lib/extensions";

/**
 * Apply the app's home-section changes (`appMarketing.homeSections`) to
 * the kit list: insert → replace → remove. Without app changes the kit
 * list comes back as is.
 */
export function composeHomeSections(
	kit: readonly HomeSection[],
	app: AppHomeSections | undefined,
): HomeSection[] {
	if (!app) return [...kit];
	const inserted = insertAfter<HomeSection>(
		kit,
		(app.insert ?? []).map(({ after, key, Component }) => ({
			after,
			item: { key, Component },
		})),
		(section) => section.key,
	);
	const replace: Partial<Record<string, HomeSection["Component"]>> =
		app.replace ?? {};
	const remove = new Set<string>(app.remove ?? []);
	return inserted
		.filter((section) => !remove.has(section.key))
		.map((section) => {
			const Component = replace[section.key];
			return Component ? { ...section, Component } : section;
		});
}
