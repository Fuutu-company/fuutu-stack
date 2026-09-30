import { auth } from "@fuutu/auth";
import { type UserWithRole, userHasPermission } from "@fuutu/auth/types";
import { getOrganizationBySlug } from "@fuutu/db";
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
