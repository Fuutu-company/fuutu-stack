/**
 * Shared auth types.
 *
 * The Better Auth `admin` plugin adds a `role` field to the user record
 * but does not widen the inferred `User` type across all entry points
 * (especially on the session returned from `getSession()`). We declare a
 * thin helper type and a narrow guard so call sites don't have to cast.
 */

import {
	type KnownPermission,
	hasSystemPermission as rbacHasSystemPermission,
	type SystemAccessControl,
	type SystemRole,
	toSystemRole,
} from "@fuutu/rbac";

export type UserRole = "admin" | "user";

/**
 * User with the admin-plugin role field narrowed.
 * The underlying value may be `null`/`undefined` for legacy rows.
 */
export interface UserWithRole {
	id: string;
	email: string;
	name: string;
	image?: string | null;
	emailVerified?: boolean | null;
	createdAt?: Date | string | null;
	updatedAt?: Date | string | null;
	role?: UserRole | string | null;
	banned?: boolean | null;
	banReason?: string | null;
	banExpires?: Date | string | null;
}

/**
 * Returns the effective SYSTEM role for a user, defaulting to "member".
 * Normalizes Better-Auth comma-separated role strings (e.g. "admin,user")
 * to the canonical RBAC system role via `toSystemRole`.
 */
export function getUserRole(user: UserWithRole | null | undefined): SystemRole {
	return toSystemRole(user?.role);
}

/**
 * Check if a user has a specific SYSTEM permission via SystemAccessControl.
 * Normalizes the user's system role first via `toSystemRole`.
 */
export function userHasPermission(
	ac: SystemAccessControl,
	user: UserWithRole | null | undefined,
	permission: KnownPermission,
): boolean {
	return rbacHasSystemPermission(ac, toSystemRole(user?.role), permission);
}
