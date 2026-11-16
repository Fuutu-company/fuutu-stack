import type { ComponentType } from "react";

/** Extra tab on `/admin/users/[id]` — see `apps/saas/src/app-admin.tsx`. */
export interface AppAdminUserSection {
	/** Unique tab key; must not reuse a kit tab key. */
	key: string;
	/** Tab label, i18n key under `admin.sections.*` (add it in every locale). */
	titleKey: string;
	Component: ComponentType<{ userId: string }>;
}

/** Extra tab on `/admin/organizations/[id]` — see `apps/saas/src/app-admin.tsx`. */
export interface AppAdminOrganizationSection {
	/** Unique tab key; must not reuse a kit tab key. */
	key: string;
	/** Tab label, i18n key under `admin.sections.*` (add it in every locale). */
	titleKey: string;
	Component: ComponentType<{ organizationId: string }>;
}

/** Kit tab keys of the user detail — an app section may not reuse them. */
export const KIT_USER_TAB_KEYS = [
	"overview",
	"sessions",
	"organizations",
	"billing",
	"apiKeys",
	"activity",
] as const;

/** Kit tab keys of the organization detail. */
export const KIT_ORGANIZATION_TAB_KEYS = [
	"members",
	"invitations",
	"billing",
	"apiKeys",
	"activity",
] as const;

/**
 * App sections for a detail page. Throws on a duplicate or kit-colliding
 * key — loud on purpose: dropping the tab would hide it silently.
 */
export function resolveAdminSections<T extends { key: string }>(
	kitKeys: readonly string[],
	appSections: readonly T[],
): readonly T[] {
	const seen = new Set<string>(kitKeys);
	for (const { key } of appSections) {
		if (seen.has(key)) {
			throw new Error(`Admin detail sections: duplicate key "${key}"`);
		}
		seen.add(key);
	}
	return appSections;
}
