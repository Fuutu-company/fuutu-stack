/**
 * @fuutu/rbac — lightweight Role-Based Access Control primitives.
 *
 * The stack has TWO independent role systems:
 *
 * 1. SYSTEM roles (Better-Auth `admin` plugin → `user.role`)
 *    Values: "admin" | "user"  (no mapping needed — RBAC uses the same names)
 *    No "owner" on system level — owner is an org-only concept.
 *    Used by: permissionProcedure() / adminProcedure
 *
 * 2. ORG roles (Better-Auth `organization` plugin → `member.role`)
 *    Values: "owner" | "admin" | "member"
 *    Used by: requireOrgRole() / requireOrgPermission() / requireOrgPermissionAccess()
 *
 * Both systems use the same PERMISSIONS but have separate hierarchies,
 * separate policies, and separate AccessControl instances.
 */

export const CRUD_ACTIONS = ["view", "create", "update", "delete"] as const;
export type CrudAction = (typeof CRUD_ACTIONS)[number];

// ─── System roles (Better-Auth admin plugin: "user" | "admin") ─────────────
export const SYSTEM_ROLE_HIERARCHY = ["user", "admin"] as const;
export type SystemRole = (typeof SYSTEM_ROLE_HIERARCHY)[number];

// ─── Org roles (Better-Auth organization plugin: "member" | "admin" | "owner") ─
export const ORG_ROLE_HIERARCHY = ["member", "admin", "owner"] as const;
export type OrgRole = (typeof ORG_ROLE_HIERARCHY)[number];

/**
 * Maps a Better-Auth SYSTEM role string onto the RBAC system role hierarchy.
 * Better-Auth stores roles as a comma-separated string (e.g. "admin,user").
 * Returns `"user"` (lowest privilege) for unknown/empty values.
 * Never returns "owner" — that's an org-only concept.
 */
export function toSystemRole(raw: string | null | undefined): SystemRole {
	const parts = (raw ?? "")
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean);
	if (parts.includes("admin")) return "admin";
	return "user";
}

/**
 * Maps a Better-Auth ORG role string onto the RBAC org role hierarchy.
 * Better-Auth stores org member roles as "owner" | "admin" | "member".
 * Returns `"member"` (lowest privilege) for unknown/empty values.
 */
export function toOrgRole(raw: string | null | undefined): OrgRole {
	const parts = (raw ?? "")
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean);
	if (parts.includes("owner")) return "owner";
	if (parts.includes("admin")) return "admin";
	return "member";
}

// ─── Backward compat: unified Role + toRbacRole (DEPRECATED) ───────────────
// Kept for transition. Prefer toSystemRole() / toOrgRole().
/** @deprecated Use `SystemRole` or `OrgRole` instead. */
export type Role = SystemRole | OrgRole;
/** @deprecated Use `toSystemRole()` or `toOrgRole()` instead. */
export function toRbacRole(raw: string | null | undefined): Role {
	const parts = (raw ?? "")
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean);
	if (parts.includes("owner")) return "owner";
	if (parts.includes("admin")) return "admin";
	if (parts.includes("user")) return "user";
	return "member";
}

/** True when `role` sits at or above `required` in the org hierarchy. */
export function hasRoleAtLeast(role: OrgRole, required: OrgRole): boolean {
	return (
		ORG_ROLE_HIERARCHY.indexOf(role) >= ORG_ROLE_HIERARCHY.indexOf(required)
	);
}

export type ResourcePermissions<TResource extends string> = {
	[A in CrudAction]: `${A}:${TResource}`;
};

/**
 * Factory that produces the canonical CRUD permission strings for a resource.
 *
 * ```ts
 * const posts = createResourcePermissions("posts");
 * // posts.view   === "view:posts"
 * // posts.update === "update:posts"
 * ```
 */
export function createResourcePermissions<const TResource extends string>(
	resource: TResource,
): ResourcePermissions<TResource> {
	return {
		view: `view:${resource}`,
		create: `create:${resource}`,
		update: `update:${resource}`,
		delete: `delete:${resource}`,
	};
}

export type Permission = string;

// ─── System policy types ───────────────────────────────────────────────────
export type SystemAccessPolicy<TPermission extends Permission = Permission> =
	Record<SystemRole, readonly TPermission[]>;

export class SystemAccessControl<TPermission extends Permission = Permission> {
	constructor(private readonly policy: SystemAccessPolicy<TPermission>) {}

	/**
	 * True when `role` is granted `permission` — either directly or via a
	 * higher role in the system hierarchy (admin inherits user).
	 */
	can(role: SystemRole, permission: TPermission): boolean {
		const idx = SYSTEM_ROLE_HIERARCHY.indexOf(role);
		if (idx === -1) return false;
		for (const r of SYSTEM_ROLE_HIERARCHY.slice(0, idx + 1)) {
			if (this.policy[r].includes(permission)) return true;
		}
		return false;
	}

	permissionsFor(role: SystemRole): readonly TPermission[] {
		const idx = SYSTEM_ROLE_HIERARCHY.indexOf(role);
		if (idx === -1) return [];
		const set = new Set<TPermission>();
		for (const r of SYSTEM_ROLE_HIERARCHY.slice(0, idx + 1)) {
			for (const p of this.policy[r]) set.add(p);
		}
		return Array.from(set);
	}
}

// ─── Org policy types ──────────────────────────────────────────────────────
export type OrgAccessPolicy<TPermission extends Permission = Permission> =
	Record<OrgRole, readonly TPermission[]>;

export class OrgAccessControl<TPermission extends Permission = Permission> {
	constructor(private readonly policy: OrgAccessPolicy<TPermission>) {}

	/**
	 * True when `role` is granted `permission` — either directly or via a
	 * higher role in the org hierarchy (owner inherits admin inherits member).
	 */
	can(role: OrgRole, permission: TPermission): boolean {
		const idx = ORG_ROLE_HIERARCHY.indexOf(role);
		if (idx === -1) return false;
		for (const r of ORG_ROLE_HIERARCHY.slice(0, idx + 1)) {
			if (this.policy[r].includes(permission)) return true;
		}
		return false;
	}

	permissionsFor(role: OrgRole): readonly TPermission[] {
		const idx = ORG_ROLE_HIERARCHY.indexOf(role);
		if (idx === -1) return [];
		const set = new Set<TPermission>();
		for (const r of ORG_ROLE_HIERARCHY.slice(0, idx + 1)) {
			for (const p of this.policy[r]) set.add(p);
		}
		return Array.from(set);
	}
}

// ─── Convenience helpers ───────────────────────────────────────────────────
export function hasSystemPermission<TPermission extends Permission>(
	ac: SystemAccessControl<TPermission>,
	role: SystemRole | null | undefined,
	permission: TPermission,
): boolean {
	if (!role) return false;
	return ac.can(role, permission);
}

export function hasOrgPermission<TPermission extends Permission>(
	ac: OrgAccessControl<TPermission>,
	role: OrgRole | null | undefined,
	permission: TPermission,
): boolean {
	if (!role) return false;
	return ac.can(role, permission);
}

// ─── Polymorphic helpers (work with either SystemAccessControl or OrgAccessControl) ──
type AnyAccessControl<TPermission extends Permission = Permission> =
	| SystemAccessControl<TPermission>
	| OrgAccessControl<TPermission>;

/** Returns true when `role` has view/create/update/delete for `resource`. */
export function canCRUD<
	TResource extends string,
	TPermission extends Permission,
>(
	ac: AnyAccessControl<TPermission>,
	role: Role | null | undefined,
	resource: TResource,
): Record<CrudAction, boolean> {
	const perms = createResourcePermissions(resource);
	const check = (p: string): boolean => {
		if (!role) return false;
		if (ac instanceof SystemAccessControl) {
			return ac.can(role as SystemRole, p as TPermission);
		}
		return ac.can(role as OrgRole, p as TPermission);
	};
	return {
		view: check(perms.view),
		create: check(perms.create),
		update: check(perms.update),
		delete: check(perms.delete),
	};
}

/**
 * Binds an AccessControl instance to a specific role, returning a
 * lightweight checker suitable for passing into React components or
 * oRPC middleware contexts.
 */
export function createPermissionChecker<TPermission extends Permission>(
	ac: AnyAccessControl<TPermission>,
	role: Role | null | undefined,
) {
	const check = (p: TPermission): boolean => {
		if (!role) return false;
		if (ac instanceof SystemAccessControl) {
			return ac.can(role as SystemRole, p);
		}
		return ac.can(role as OrgRole, p);
	};
	return {
		role,
		can: (permission: TPermission) => check(permission),
		canAny: (permissions: readonly TPermission[]) =>
			permissions.some((p) => check(p)),
		canAll: (permissions: readonly TPermission[]) =>
			permissions.every((p) => check(p)),
	};
}

export {
	DEFAULT_ACCESS_POLICY,
	type KnownPermission,
	ORG_POLICY,
	PERMISSIONS,
	SYSTEM_POLICY,
} from "./policy";
