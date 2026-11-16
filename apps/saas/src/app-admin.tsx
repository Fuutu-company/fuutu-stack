import type {
	AppAdminOrganizationSection,
	AppAdminUserSection,
} from "./modules/app/admin/admin-sections";

/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Extra tabs on the system-admin detail pages, rendered after the kit tabs
 * by `modules/app/admin/user-detail/admin-user-detail.tsx` and
 * `modules/app/admin/org-detail/admin-organization-detail.tsx` — add yours
 * here instead of forking those pages.
 *
 * Every section:
 * - `key`: unique tab key. Reusing a kit tab key (users: `overview`,
 *   `sessions`, `organizations`, `billing`, `apiKeys`, `activity`;
 *   organizations: `members`, `invitations`, `billing`, `apiKeys`,
 *   `activity`) or another section's key throws when the page renders —
 *   deliberately loud. `app-admin.test.ts` (test-utils) checks these lists
 *   against the kit keys, so a collision fails CI first.
 * - `titleKey`: tab label, i18n key under `admin.sections.*` (add it in
 *   every locale).
 * - `Component`: renders the tab body (a client component works — the
 *   pages are). It receives the id of the viewed user / organization;
 *   load your data through your own oRPC procedure with
 *   `systemAdminProcedure(...)`: this registry only renders UI, the
 *   procedure must enforce access server-side.
 *
 * ```tsx
 * export const appAdminUserSections: readonly AppAdminUserSection[] = [
 *   { key: "tickets", titleKey: "tickets", Component: UserTickets },
 * ];
 * ```
 */
export const appAdminUserSections: readonly AppAdminUserSection[] = [];

export const appAdminOrganizationSections: readonly AppAdminOrganizationSection[] =
	[];
