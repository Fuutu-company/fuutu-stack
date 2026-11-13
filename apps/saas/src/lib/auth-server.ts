import { auth } from "@fuutu/auth";
import { getSignedInRedirect } from "@fuutu/auth/redirect";
import { type UserWithRole, userHasPermission } from "@fuutu/auth/types";
import { config } from "@fuutu/config";
import { countOrganizationsForUser, getOrganizationBySlug } from "@fuutu/db";
import { PERMISSIONS, SYSTEM_POLICY, SystemAccessControl } from "@fuutu/rbac";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

const ac = new SystemAccessControl(SYSTEM_POLICY);

/**
 * Get the current session (cached per request)
 */
export const getSession = cache(async () => {
	return await auth.api.getSession({
		headers: await headers(),
	});
});

/**
 * Require authentication - redirect to sign-in if not authenticated
 * Use this in server components/layouts that need authentication
 */
export async function requireAuth() {
	const session = await getSession();

	if (!session) {
		redirect("/auth/sign-in");
	}

	const user = session.user as UserWithRole;
	if (user?.banned) {
		redirect("/auth/suspended");
	}

	return session;
}

/**
 * Sign-in / sign-up only: a visitor with a valid session goes straight to the
 * post-login destination (`getSignedInRedirect`). A signed OAuth
 * authorization request (`sig`) keeps the page.
 */
export async function redirectIfSignedIn(
	params: Record<string, string | string[] | undefined>,
) {
	const target = getSignedInRedirect(params);
	if (target === null) return;
	const session = await getSession();
	if (!session) return;
	redirect(target);
}

/**
 * Require admin role - redirect if not authenticated or not admin
 * Better Auth stores role on user record (set via admin plugin)
 */
export async function requireAdmin() {
	const session = await requireAuth();

	if (
		!userHasPermission(ac, session.user as UserWithRole, PERMISSIONS.VIEW_ADMIN)
	) {
		redirect("/dashboard?error=forbidden");
	}

	return session;
}

/**
 * Require authentication AND a completed onboarding flow. Use this in the
 * authenticated `(app)` layout to force new users through `/onboarding`
 * before they can access dashboard / settings / etc.
 *
 * The `/onboarding` page itself uses `requireAuth()` (no recursion).
 */
export async function requireOnboarded() {
	const session = await requireAuth();
	let user = session.user as UserWithRole & { onboardingComplete?: boolean };
	if (user.onboardingComplete === false) {
		// The session payload may come from Better Auth's cookie cache (5min TTL)
		// and still carry onboardingComplete=false after the wizard flipped the
		// DB flag. Re-check against a fresh session before redirecting — this
		// avoids trapping users in /onboarding until the cache expires.
		const fresh = await auth.api.getSession({
			headers: await headers(),
			query: { disableCookieCache: true },
		});
		user = (fresh?.user ?? user) as typeof user;
		if (user.onboardingComplete === false) {
			const pathname = (await headers()).get("x-pathname") ?? "";
			if (!pathname.startsWith("/onboarding")) {
				redirect("/onboarding");
			}
		}
	}
	return session;
}

/**
 * Require authentication AND — when `features.organizationsMode === "forced"`
 * — membership in at least one organization. A user with zero memberships is
 * redirected to `/organizations` (the forced-mode landing where they can
 * create an org or accept a pending invitation), unless the request already
 * targets `/organizations` or `/onboarding`.
 *
 * No-op in "off" and "on" modes. The proxy pre-check is only an optimistic
 * hint — this DB-backed check is the real gate.
 */
export async function requireOrg() {
	const session = await requireAuth();
	if (config.features.organizationsMode !== "forced") {
		return session;
	}
	const orgCount = await countOrganizationsForUser(session.user.id);
	if (orgCount === 0) {
		const pathname = (await headers()).get("x-pathname") ?? "";
		if (
			!pathname.startsWith("/organizations") &&
			!pathname.startsWith("/onboarding")
		) {
			redirect("/organizations");
		}
	}
	return session;
}

/**
 * Require authentication AND membership in the organization identified by
 * `slug`. Use this in org-scoped layouts — oRPC procedures still enforce
 * org permissions server-side, but the layout guard keeps the page shell
 * (nav, settings chrome) from rendering for non-members.
 *
 * Redirects to /organizations when the org doesn't exist or the user is
 * not a member — mirrors the per-page checks (e.g. audit-log page).
 */
export async function requireOrgMembership(slug: string) {
	const session = await requireOnboarded();

	const org = await getOrganizationBySlug(slug);
	if (!org) {
		redirect("/organizations");
	}

	const fullOrg = await auth.api.getFullOrganization({
		query: { organizationId: org.id },
		headers: await headers(),
	});
	const isMember = fullOrg?.members?.some(
		(m: { userId: string }) => m.userId === session.user.id,
	);
	if (!isMember) {
		redirect("/organizations");
	}

	// Forced mode: entering an org route implies org context — activate the
	// org on the session so the proxy hint and active-org resolution work
	// without requiring a manual switcher pick. "on" mode keeps the
	// personal/org toggle unchanged (membership != active scope there).
	if (
		config.features.organizationsMode === "forced" &&
		(session.session as { activeOrganizationId?: string | null })
			.activeOrganizationId !== org.id
	) {
		try {
			await auth.api.setActiveOrganization({
				headers: await headers(),
				body: { organizationId: org.id },
			});
		} catch {
			// Membership is already proven — a failed active-org update
			// must not block the route.
		}
	}

	return { session, org };
}

/**
 * Get the current user (server-side only)
 * Returns null if not authenticated
 */
export async function getCurrentUser() {
	const session = await getSession();
	return session?.user ?? null;
}
