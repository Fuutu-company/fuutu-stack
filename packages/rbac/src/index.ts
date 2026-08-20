/**
 * @fuutu/rbac — lightweight Role-Based Access Control primitives.
 *
 * Core ideas:
 *  - A small, ordered role hierarchy: `member < admin < owner`.
 *  - Resource-scoped permissions produced by `createResourcePermissions`
 *    (e.g. "view:posts", "update:posts"). No stringly-typed freestyle.
 *  - An `AccessControl` policy that maps roles → permission sets and
 *    exposes `.can(role, permission)` for runtime checks.
 *  - Convenience helpers (`hasPermission`, `canCRUD`, `createPermissionChecker`)
 *    so oRPC procedures and UI gates share one API.
 */

export const CRUD_ACTIONS = ["view", "create", "update", "delete"] as const;
export type CrudAction = (typeof CRUD_ACTIONS)[number];

export const ROLE_HIERARCHY = ["member", "admin", "owner"] as const;
export type Role = (typeof ROLE_HIERARCHY)[number];

/**
 * Maps Better-Auth roles onto the `@fuutu/rbac` role hierarchy.
 * Better-Auth stores roles as a comma-separated string (e.g. "admin,user").
 * Splits, trims, and picks the highest matching role.
 * Returns `"member"` (lowest privilege) for unknown/empty values.
 */
export function toRbacRole(raw: string | null | undefined): Role {
	const parts = (raw ?? "")
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean);
	if (parts.includes("owner")) return "owner";
	if (parts.includes("admin")) return "admin";
	return "member";
}

/** True when `role` sits at or above `required` in the hierarchy. */
export function hasRoleAtLeast(role: Role, required: Role): boolean {
	return ROLE_HIERARCHY.indexOf(role) >= ROLE_HIERARCHY.indexOf(required);
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

export type AccessPolicy<TPermission extends Permission = Permission> = Record<
	Role,
	readonly TPermission[]
>;

export class AccessControl<TPermission extends Permission = Permission> {
	constructor(private readonly policy: AccessPolicy<TPermission>) {}

	/**
	 * True when `role` is granted `permission` — either directly or via a
	 * higher role in the hierarchy (owner inherits admin inherits member).
	 */
	can(role: Role, permission: TPermission): boolean {
		const idx = ROLE_HIERARCHY.indexOf(role);
		if (idx === -1) return false;
		for (const r of ROLE_HIERARCHY.slice(0, idx + 1)) {
			if (this.policy[r].includes(permission)) return true;
		}
		return false;
	}

	permissionsFor(role: Role): readonly TPermission[] {
		const idx = ROLE_HIERARCHY.indexOf(role);
		if (idx === -1) return [];
		const set = new Set<TPermission>();
		for (const r of ROLE_HIERARCHY.slice(0, idx + 1)) {
			for (const p of this.policy[r]) set.add(p);
		}
		return Array.from(set);
	}
}

export function hasPermission<TPermission extends Permission>(
	ac: AccessControl<TPermission>,
	role: Role | null | undefined,
	permission: TPermission,
): boolean {
	if (!role) return false;
	return ac.can(role, permission);
}

/** Returns true when `role` has view/create/update/delete for `resource`. */
export function canCRUD<TResource extends string>(
	ac: AccessControl,
	role: Role | null | undefined,
	resource: TResource,
): Record<CrudAction, boolean> {
	const perms = createResourcePermissions(resource);
	return {
		view: hasPermission(ac, role, perms.view),
		create: hasPermission(ac, role, perms.create),
		update: hasPermission(ac, role, perms.update),
		delete: hasPermission(ac, role, perms.delete),
	};
}

/**
 * Binds an AccessControl instance to a specific role, returning a
 * lightweight checker suitable for passing into React components or
 * oRPC middleware contexts.
 */
export function createPermissionChecker<TPermission extends Permission>(
	ac: AccessControl<TPermission>,
	role: Role | null | undefined,
) {
	return {
		role,
		can: (permission: TPermission) => hasPermission(ac, role, permission),
		canAny: (permissions: readonly TPermission[]) =>
			permissions.some((p) => hasPermission(ac, role, p)),
		canAll: (permissions: readonly TPermission[]) =>
			permissions.every((p) => hasPermission(ac, role, p)),
	};
}

export { DEFAULT_ACCESS_POLICY, PERMISSIONS } from "./policy";
