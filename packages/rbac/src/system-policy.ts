import type { SystemAccessPolicy } from "./index";
import { crud, PERMISSIONS } from "./permissions";

/**
 * System policy — what a user may do based on their SYSTEM role.
 *
 * Source: Better-Auth `admin` plugin → `user.role`
 * Roles:  "user" (regular user) | "admin" (system admin)
 * No "owner" — that's an org-only concept.
 *
 * Checked by: `permissionProcedure()` / `adminProcedure` via `context.user.role`
 *
 * Permission categories:
 * - User-scoped resources (api-key, chat, storage, crm): full CRUD — user owns these
 * - System-generated resources (notification, credit, activity): view only (+ update for notifications)
 * - Payment: view only (invoices, subscriptions) — create/update are org-scoped or admin-only
 * - Organization: create + view only — update/delete are org-level decisions (ORG_POLICY)
 * - Webhook: NOT here — webhooks are always org-scoped (see ORG_POLICY)
 *
 * - user:  own resources + view system-generated + create/view orgs + use:ai
 * - admin: everything user has + manage users/audit-logs/payments/admin + admin panel
 */
export const SYSTEM_POLICY: SystemAccessPolicy = {
	user: [
		// User-scoped — full CRUD (user owns these)
		...crud("api-key"),
		...crud("chat"),
		...crud("storage"),
		...crud("crm"),
		// System-generated — view only (user can't create/delete these)
		PERMISSIONS.NOTIFICATION.VIEW,
		PERMISSIONS.NOTIFICATION.UPDATE, // mark as read
		PERMISSIONS.CREDIT.VIEW,
		PERMISSIONS.ACTIVITY.VIEW,
		// Payment — view only (invoices, subscriptions)
		PERMISSIONS.PAYMENT.VIEW,
		// Organization — create + view only (update/delete gated by ORG_POLICY)
		PERMISSIONS.ORGANIZATION.CREATE,
		PERMISSIONS.ORGANIZATION.VIEW,
		// Custom
		PERMISSIONS.USE_AI,
	],
	admin: [
		// Admin-only resources
		...crud("user"),
		...crud("audit-log"),
		...crud("payment"),
		...crud("admin"),
		PERMISSIONS.VIEW_ADMIN,
	],
};
