/**
 * Shared auth types.
 *
 * The Better Auth `admin` plugin adds a `role` field to the user record
 * but does not widen the inferred `User` type across all entry points
 * (especially on the session returned from `getSession()`). We declare a
 * thin helper type and a narrow guard so call sites don't have to cast.
 */

import { hasRoleAtLeast, type Role, toRbacRole } from "@fuutu/rbac";

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
 * Returns the effective role for a user, defaulting to "member".
 * Normalizes Better-Auth comma-separated role strings (e.g. "admin,user")
 * to the canonical RBAC role via `toRbacRole`.
 */
export function getUserRole(user: UserWithRole | null | undefined): Role {
	return toRbacRole(user?.role);
}

/**
 * Type guard: true when the user has admin privileges.
 * Normalizes comma-separated roles first — "admin,user" → admin.
 */
export function isAdmin(user: UserWithRole | null | undefined): boolean {
	return hasRoleAtLeast(toRbacRole(user?.role), "admin");
}
