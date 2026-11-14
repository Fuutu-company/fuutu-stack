import type { Metadata } from "next";
import type { AppPageMetadata } from "./extensions";

/** The object without its `undefined` fields — so a spread keeps the base value. */
export function definedFields<T extends object>(value: T): Partial<T> {
	return Object.fromEntries(
		Object.entries(value).filter(([, v]) => v !== undefined),
	) as Partial<T>;
}

/**
 * The kit page metadata with the app's override (`appMarketing.metadata`)
 * merged over it — see `AppPageMetadata`. Without an override the kit
 * object comes back unchanged.
 */
export async function withAppMetadata(
	kit: Metadata,
	app: AppPageMetadata | undefined,
	locale: string,
): Promise<Metadata> {
	if (!app) return kit;
	const extra = definedFields(
		typeof app === "function" ? await app({ locale }) : app,
	);
	const merged: Metadata = { ...kit, ...extra };
	if (kit.alternates && extra.alternates) {
		merged.alternates = { ...kit.alternates, ...extra.alternates };
	}
	if (kit.openGraph && extra.openGraph) {
		merged.openGraph = {
			...kit.openGraph,
			...extra.openGraph,
		} as Metadata["openGraph"];
	}
	return merged;
}
