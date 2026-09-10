/**
 * Unified authorization middleware — the single entry point for all
 * permission, plan, and limit checks in the API.
 *
 * Instead of chaining multiple middlewares, a developer declares everything
 * in one config object. The middleware determines the **scope** of the action
 * from the input and runs the appropriate permission check:
 *
 *   - If `organizationId` is present in the input → **org-scoped action**
 *     → org membership + org permission is checked (system permission skipped)
 *   - If `organizationId` is absent → **user-scoped action**
 *     → system permission is checked (org check skipped if optional)
 *
 * This means: for dual-scoped resources (api-keys, crm, storage), the same
 * procedure handles both personal and org actions. The presence of
 * `organizationId` in the request determines which permission is authoritative.
 * A user with org permission but no system permission can still act in the org
 * context — and vice versa.
 *
 * Check order:
 *   1. Auth (user must be authenticated)
 *   2. Scope detection (orgId in input? → org-scoped : user-scoped)
 *   3. Permission check (org OR system, depending on scope)
 *   4. Plan tier (resolves active plan, checks tier >= required)
 *   5. Active subscription (if requireActiveSubscription is set)
 *   6. Limit (counts current resources, checks against plan limit)
 *
 * Resolved data is attached to the oRPC context:
 *   - systemRole: SystemRole
 *   - org?: FullOrganization (when org-scoped)
 *   - orgRole?: OrgRole (when org-scoped)
 *   - membership?: OrgMember (when org-scoped)
 *   - planId?: PlanId (when plan/limit options set)
 *   - planTier?: PlanTier (when plan/limit options set)
 */

import { auth } from "@fuutu/auth";
import type { UserWithRole } from "@fuutu/auth/types";
import {
	checkLimit,
	getPlanLimit,
	type LimitKey,
	meetsTier,
	type PlanTier,
	resolveActivePlan,
} from "@fuutu/payments";
import type { PlanId } from "@fuutu/payments/config";
import { paymentsConfig } from "@fuutu/payments/config";
import {
	hasOrgPermission,
	hasSystemPermission,
	type KnownPermission,
	ORG_POLICY,
	OrgAccessControl,
	type OrgRole,
	PERMISSIONS,
	SYSTEM_POLICY,
	SystemAccessControl,
	toOrgRole,
	toSystemRole,
} from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import type { Context } from "../../context";

// ─── Access Control instances (module-level singletons) ─────────────────────
const systemAC = new SystemAccessControl(SYSTEM_POLICY);
const orgAC = new OrgAccessControl(ORG_POLICY);

// ─── Types ───────────────────────────────────────────────────────────────────

export type OrgMember = {
	id?: string;
	userId: string;
	role: string;
	email?: string;
};

export type FullOrganization = NonNullable<
	Awaited<ReturnType<typeof auth.api.getFullOrganization>>
>;

export type AuthorizeContext = {
	user: UserWithRole;
	systemRole: ReturnType<typeof toSystemRole>;
	org?: FullOrganization;
	orgRole?: OrgRole;
	membership?: OrgMember;
	planId?: PlanId;
	planTier?: PlanTier;
};

export type AuthorizeOptions = {
	/** Require a specific system-level permission (checked against SYSTEM_POLICY). */
	systemPermission?: KnownPermission;
	/** Resolve org from input, verify membership, check org-level permission. */
	org?: {
		permission: KnownPermission;
		/** Which input field contains the organizationId. Default: "organizationId". */
		idField?: string;
		/** If true, skip org check when the field is absent/undefined. */
		optional?: boolean;
	};
	/** Require a minimum plan tier (free | pro | enterprise). */
	plan?: PlanTier;
	/** Require an active paid subscription (not just free tier). */
	requireActiveSubscription?: boolean;
	/** Enforce a plan limit — counts current resources, checks against LIMITS. */
	limit?: {
		key: LimitKey;
		/** Async function that returns the current count. Receives the resolved context. */
		count: (ctx: AuthorizeContext) => Promise<number>;
	};
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Safely extract a string field from raw (possibly unparsed) input.
 * Returns undefined when input is null/undefined or the field is absent.
 */
function getInputField(input: unknown, field: string): string | undefined {
	if (!input || typeof input !== "object") return undefined;
	const val = (input as Record<string, unknown>)[field];
	return typeof val === "string" && val.length > 0 ? val : undefined;
}

/**
 * Core authorization logic — runs all checks and returns the resolved context.
 * Used by `authProcedure` in `procedures.ts`.
 *
 * Throws ORPCError on any check failure.
 */
export async function runAuthorize(
	options: AuthorizeOptions,
	context: Context,
	input: unknown,
): Promise<AuthorizeContext> {
	// 1. Auth — user must be authenticated
	if (!context.session?.user) {
		throw new ORPCError("UNAUTHORIZED");
	}
	const user = context.session.user as UserWithRole;
	const systemRole = toSystemRole(user.role);

	const ctx: AuthorizeContext = { user, systemRole };

	// 2. Determine scope: is this an org-scoped or user-scoped action?
	// The presence of organizationId in the input determines which permission
	// check is authoritative:
	//   - orgId present  → org-scoped  → org permission is the gate (system skipped)
	//   - orgId absent   → user-scoped → system permission is the gate (org skipped if optional)
	const orgIdField = options.org?.idField ?? "organizationId";
	const orgId = options.org ? getInputField(input, orgIdField) : undefined;
	const isOrgScoped = orgId !== undefined;

	// 3. Org-scoped: check org membership + org permission (the authority for org actions)
	if (isOrgScoped) {
		let org: FullOrganization | null;
		try {
			org = await auth.api.getFullOrganization({
				query: { organizationId: orgId as string },
				headers: context.headers,
			});
		} catch (e) {
			// Better-Auth APIError: { name: "APIError", statusCode: 400, body.code: "ORGANIZATION_NOT_FOUND" }
			if (
				e instanceof Error &&
				e.name === "APIError" &&
				"statusCode" in e &&
				(e as { statusCode: number }).statusCode === 400
			) {
				org = null;
			} else {
				throw e;
			}
		}
		if (!org) {
			throw new ORPCError("NOT_FOUND", { message: "Organization not found" });
		}
		const member = org.members?.find((m: OrgMember) => m.userId === user.id);
		if (!member) {
			throw new ORPCError("FORBIDDEN", { message: "Not a member" });
		}
		const orgRole = toOrgRole(member.role);
		if (
			options.org &&
			!hasOrgPermission(orgAC, orgRole, options.org.permission)
		) {
			throw new ORPCError("FORBIDDEN", { message: "Insufficient permissions" });
		}
		ctx.org = org;
		ctx.orgRole = orgRole;
		ctx.membership = member;
	} else {
		// 4. User-scoped: check system permission (the authority for user actions)
		// If org was required (not optional) but no orgId provided → error
		if (options.org && !options.org.optional) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Organization ID is required",
			});
		}
		if (
			options.systemPermission &&
			!hasSystemPermission(systemAC, systemRole, options.systemPermission)
		) {
			throw new ORPCError("FORBIDDEN", { message: "Insufficient permissions" });
		}
	}

	// 5. Plan tier
	if (options.plan || options.requireActiveSubscription || options.limit) {
		const resolved = await resolveActivePlan(user.id, ctx.org?.id);
		ctx.planId = resolved.planId;
		ctx.planTier = resolved.tier;

		if (options.plan && !meetsTier(resolved.tier, options.plan)) {
			throw new ORPCError("FORBIDDEN", {
				message: "This feature requires a higher plan",
			});
		}

		// 6. Active subscription
		if (
			options.requireActiveSubscription &&
			paymentsConfig.requireActiveSubscription &&
			resolved.planId === "free"
		) {
			throw new ORPCError("FORBIDDEN", {
				message: "An active subscription is required",
			});
		}
	}

	// 6. Limit enforcement
	if (options.limit) {
		const limitValue = getPlanLimit(ctx.planId ?? "free", options.limit.key);
		const currentCount = await options.limit.count(ctx);
		const result = checkLimit(limitValue, currentCount);
		if (!result.ok) {
			if (result.reason === "feature-not-available") {
				throw new ORPCError("FORBIDDEN", {
					message: "This feature is not available on your plan",
				});
			}
			throw new ORPCError("FORBIDDEN", {
				message: `Limit exceeded (${result.current}/${result.limit})`,
			});
		}
	}

	return ctx;
}

// Re-export PERMISSIONS for convenience
export { PERMISSIONS };
