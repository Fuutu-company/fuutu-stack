import type {
	AppAccountNavItem,
	AppAdminNavItem,
	AppOrgSettingsNavItem,
} from "./modules/app/components/nav-config";

/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Extra sidebar items and breadcrumb labels for the SaaS app, merged into
 * the kit lists by `modules/app/components/nav-config.ts` and
 * `breadcrumbs.ts` — add yours here instead of editing those files.
 *
 * Every item:
 * - `titleKey`: i18n key under `navigation.*` (add it in every locale);
 *   also the item's unique key. Reusing a kit key (or another app item's)
 *   throws when the sidebar renders — deliberately loud: skipping would
 *   hide your item silently. `app-navigation.test.ts` (test-utils) checks
 *   these lists against the kit keys, so a collision fails CI first.
 * - `after`: kit item key to place it behind (typed per group). Omitted,
 *   or the anchor is hidden (e.g. `billing` with user billing), the item
 *   is appended to the group.
 * - `enabled`: static feature gate, e.g. `config.features.myFeature`.
 *
 * Org settings items take a `segment` (route under
 * `/organizations/<slug>/settings/`) and an optional `permission`
 * (`PERMISSIONS.*` from `@fuutu/rbac`) checked against the viewer's org
 * role. The sidebar is a convenience only — the page itself must still
 * enforce access server-side (layout guard / `authProcedure`).
 *
 * ```ts
 * export const appOrgSettingsNavItems: readonly AppOrgSettingsNavItem[] = [
 *   { titleKey: "projects", segment: "projects", after: "members",
 *     permission: PERMISSIONS.ORGANIZATION.UPDATE },
 * ];
 * export const appBreadcrumbLabels = { projects: "breadcrumb.projects" };
 * ```
 */
export const appOrgSettingsNavItems: readonly AppOrgSettingsNavItem[] = [];

/** Account-settings group (`/settings`): `href` is an absolute path. */
export const appAccountNavItems: readonly AppAccountNavItem[] = [];

/** Admin group (`/admin`, system admins only): `href` is an absolute path. */
export const appAdminNavItems: readonly AppAdminNavItem[] = [];

/**
 * Breadcrumb labels for app route segments: segment → i18n key under
 * `navigation.*`. Apply to segments the kit leaves unlabelled only — a
 * kit segment always keeps its kit label.
 */
export const appBreadcrumbLabels: Readonly<Record<string, string>> = {};
