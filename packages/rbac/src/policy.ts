/**
 * Policy barrel — re-exports from the split files.
 *
 * - `permissions.ts`  → permission definitions (CUSTOM_PERMISSIONS, CRUD_RESOURCES, PERMISSIONS, KnownPermission, crud())
 * - `system-policy.ts` → SYSTEM_POLICY (system roles: member | admin)
 * - `org-policy.ts`    → ORG_POLICY (org roles: member | admin | owner)
 *
 * This file exists for backward compat — existing imports `from "./policy"` still work.
 * New code can import directly from the split files.
 */

export { ORG_POLICY } from "./org-policy";
export {
	CRUD_RESOURCES,
	type CrudResource,
	crud,
	type KnownPermission,
	PERMISSIONS,
} from "./permissions";
// Backward compat — alias for SYSTEM_POLICY (used by older code/tests)
export {
	SYSTEM_POLICY,
	SYSTEM_POLICY as DEFAULT_ACCESS_POLICY,
} from "./system-policy";
