import type { CrudAction } from "./index";

// Defined locally to avoid a circular import (index.ts re-exports from here).
const CRUD_ACTIONS = ["view", "create", "update", "delete"] as const;

// ─── Custom permissions (non-CRUD) ─────────────────────────────
// Flat or nested. See wiki/guides/rbac.md for nested custom permission examples.
const CUSTOM_PERMISSIONS = {
	USE_AI: "use:ai",
	MANAGE_BILLING: "manage:billing",
	VIEW_ADMIN: "view:admin",
	INVITE_ORGANIZATION: "invite:organization",
	REMOVE_ORGANIZATION: "remove:organization",
} as const;

// ─── CRUD resources ────────────────────────────────────────────
// Add a resource here → all 4 CRUD permissions are automatically
// generated in PERMISSIONS and valid for the type system.
export const CRUD_RESOURCES = [
	"api-key",
	"webhook",
	"notification",
	"chat",
	"credit",
	"storage",
	"crm",
	"activity",
	"organization",
	"user",
	"audit-log",
	"payment",
	"admin",
] as const;

export type CrudResource = (typeof CRUD_RESOURCES)[number];

// ─── Type utilities ────────────────────────────────────────────
// "api-key" → "API_KEY"  (for PERMISSIONS key naming)
type ScreamingSnake<S extends string> = S extends `${infer A}-${infer B}`
	? `${Uppercase<A>}_${ScreamingSnake<B>}`
	: Uppercase<S>;

// Auto-generated CRUD permission groups, nested by resource.
// e.g. { API_KEY: { VIEW: "view:api-key", CREATE: "create:api-key", ... }, ... }
type CrudPermissionMap = {
	[R in CrudResource as ScreamingSnake<R>]: {
		readonly VIEW: `view:${R}`;
		readonly CREATE: `create:${R}`;
		readonly UPDATE: `update:${R}`;
		readonly DELETE: `delete:${R}`;
	};
};

// Extract all permission string values from an object (handles nested groups).
type DeepPermissionValues<T> = T extends string
	? T
	: T extends Record<string, unknown>
		? DeepPermissionValues<T[keyof T]>
		: never;

// ─── Build CRUD permissions at runtime ─────────────────────────
function toScreamingSnake(s: string): string {
	return s.replace(/-/g, "_").toUpperCase();
}

function buildCrudPermissions(): CrudPermissionMap {
	const groups: Record<string, Record<string, string>> = {};
	for (const resource of CRUD_RESOURCES) {
		groups[toScreamingSnake(resource)] = {
			VIEW: `view:${resource}`,
			CREATE: `create:${resource}`,
			UPDATE: `update:${resource}`,
			DELETE: `delete:${resource}`,
		};
	}
	return groups as CrudPermissionMap;
}

// ─── All permissions ───────────────────────────────────────────
// Custom (flat) + CRUD (auto-generated, nested by resource).
// Usage: PERMISSIONS.ORGANIZATION.VIEW, PERMISSIONS.USE_AI, etc.
// Auto-complete: type PERMISSIONS. → shows all groups → .ORGANIZATION. → shows VIEW/CREATE/UPDATE/DELETE.
export const PERMISSIONS = {
	...CUSTOM_PERMISSIONS,
	...buildCrudPermissions(),
};

// Union of every valid permission string — what permissionProcedure() accepts.
// Derived from PERMISSIONS, so adding a CRUD resource or custom permission
// automatically extends this union.
export type KnownPermission = DeepPermissionValues<typeof PERMISSIONS>;

// ─── Policy helper ─────────────────────────────────────────────
/** Returns all 4 CRUD permission strings for a resource. */
export function crud(
	resource: CrudResource,
): `${CrudAction}:${typeof resource}`[] {
	return CRUD_ACTIONS.map(
		(action) => `${action}:${resource}` as `${CrudAction}:${typeof resource}`,
	);
}
