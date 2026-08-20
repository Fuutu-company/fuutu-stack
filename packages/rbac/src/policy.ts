import { type AccessPolicy, createResourcePermissions } from "./index";

/** Custom (non-CRUD) permissions used across the stack. */
export const PERMISSIONS = {
	// AI
	USE_AI: "use:ai",
	// Billing
	MANAGE_BILLING: "manage:billing",
	// Organization member management
	INVITE_ORGANIZATION: "invite:organization",
	REMOVE_ORGANIZATION: "remove:organization",
	UPDATE_ORGANIZATION: "update:organization",
	// Admin
	VIEW_ADMIN: "view:admin",
} as const;

/**
 * Default access policy — additive (admin inherits member, owner inherits admin).
 * AccessControl.can() walks ROLE_HIERARCHY so higher roles automatically
 * get all permissions from lower roles.
 */
export const DEFAULT_ACCESS_POLICY: AccessPolicy = {
	member: [
		...Object.values(createResourcePermissions("api-key")),
		...Object.values(createResourcePermissions("webhook")),
		...Object.values(createResourcePermissions("notification")),
		...Object.values(createResourcePermissions("chat")),
		...Object.values(createResourcePermissions("credit")),
		...Object.values(createResourcePermissions("storage")),
		...Object.values(createResourcePermissions("crm")),
		...Object.values(createResourcePermissions("activity")),
		...Object.values(createResourcePermissions("organization")),
		PERMISSIONS.USE_AI,
	],
	admin: [
		...Object.values(createResourcePermissions("user")),
		...Object.values(createResourcePermissions("audit-log")),
		...Object.values(createResourcePermissions("payment")),
		...Object.values(createResourcePermissions("admin")),
		PERMISSIONS.VIEW_ADMIN,
		PERMISSIONS.INVITE_ORGANIZATION,
		PERMISSIONS.REMOVE_ORGANIZATION,
		PERMISSIONS.UPDATE_ORGANIZATION,
	],
	owner: [PERMISSIONS.MANAGE_BILLING, "delete:organization"],
};
