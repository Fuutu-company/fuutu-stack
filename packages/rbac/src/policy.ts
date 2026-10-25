/**
 * Policy barrel — re-exports from the split files.
 *
 * - `permissions.ts`  → permission definitions (PERMISSIONS, KnownPermission, CRUD_RESOURCES, crud())
 * - `system-policy.ts` → SYSTEM_POLICY (system roles: user | admin)
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
export { SYSTEM_POLICY } from "./system-policy";
