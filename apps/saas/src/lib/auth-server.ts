import { auth } from "@fuutu/auth";
import { authConfig } from "@fuutu/auth/config";
import { isImpersonationExpired } from "@fuutu/auth/impersonation";
import { endImpersonationIfAccessLost } from "@fuutu/auth/impersonation-access";
import { endExpiredImpersonation } from "@fuutu/auth/impersonation-expiry";
import { getSignedInRedirect } from "@fuutu/auth/redirect";
import {
	isBanActive,
	type UserWithRole,
	userHasPermission,
} from "@fuutu/auth/types";
import { config } from "@fuutu/config";
import {
	countOrganizationsForUser,
	getOrganizationBySlug,
	isOrganizationMember,
} from "@fuutu/db";
import { PERMISSIONS, SYSTEM_POLICY, SystemAccessControl } from "@fuutu/rbac";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

const ac = new SystemAccessControl(SYSTEM_POLICY);

const readSession = cache(async () => {
	return await auth.api.getSession({
		headers: await headers(),
	});
});

/**
 * The current session (cached per request). An impersonation past
 * `authConfig.admin.impersonationMinutes` ends (row deleted, expiry
 * audited once), so does one whose admin lost the permission
 * (`impersonate_ended_lost_access`) or whose row is already gone —
 * `endedImpersonation` then tells `requireAuth` to sign out.
 */
const resolveSession = cache(async () => {
	const session = await readSession();
	if (session && isImpersonationExpired(session.session)) {
		await endExpiredImpersonation(session.session);
		return { session: null, endedImpersonation: true };
	}
	if (session && (await endImpersonationIfAccessLost(session.session))) {
		return { session: null, endedImpersonation: true };
	}
	return { session, endedImpersonation: false };
});

/**
 * Get the current session (cached per request). An ended impersonation
 * (expired, admin lost access, row gone) counts as signed out.
 */
export const getSession = cache(async () => (await resolveSession()).session);

/**
 * Require authentication - redirect to sign-in if not authenticated
 * Use this in server components/layouts that need authentication.
 * An ended impersonation is signed out first.
 */
export async function requireAuth() {
	const { session, endedImpersonation } = await resolveSession();
	if (endedImpersonation) {
		try {
			await auth.api.signOut({ headers: await headers() });
		} catch {
			// Already gone — the request is signed out either way.
		}
		redirect(authConfig.redirects.afterSignOut);
	}

	if (!session) {
		redirect("/auth/sign-in");
	}

	const user = session.user as UserWithRole;
	if (isBanActive(user)) {
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
	// Support acting as a user never reaches the admin area.
	if ((session.session as { impersonatedBy?: string | null }).impersonatedBy) {
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
 * The organization behind `slug` when the user is a member of it; 404
 * otherwise. An unknown slug and someone else's org answer the same, so
 * the response never tells whether an org exists or what it is called.
 */
async function orgForMember(slug: string, userId: string) {
	const org = await getOrganizationBySlug(slug);
	if (!org || !(await isOrganizationMember(userId, org.id))) {
		notFound();
	}
	return org;
}

/** `/organizations/<slug>/…` → `<slug>`; null outside an org route. */
const ORG_ROUTE = /^\/organizations\/([^/]+)\/?/;

/**
 * Org routes answer 404 to non-members before the app shell renders. Call
 * it in the `(app)` layout — above every `loading.tsx`, so the status is a
 * real 404 and no org chrome is streamed. Reads the pathname the proxy
 * forwards (`x-pathname`); the org layouts' `requireOrgMembership` still
 * applies without it.
 */
export async function notFoundUnlessOrgMember(): Promise<void> {
	const pathname = (await headers()).get("x-pathname") ?? "";
	const slug = pathname.match(ORG_ROUTE)?.[1];
	if (!slug) return;
	const session = await requireAuth();
	await orgForMember(slug, session.user.id);
}

/**
 * Require authentication AND membership in the organization identified by
 * `slug`. Use this in org-scoped layouts — oRPC procedures still enforce
 * org permissions server-side, but the layout guard keeps the page shell
 * (nav, settings chrome) from rendering for non-members.
 *
 * 404 when the org doesn't exist or the user is not a member.
 */
export async function requireOrgMembership(slug: string) {
	const session = await requireOnboarded();
	const org = await orgForMember(slug, session.user.id);

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
 * Whether Better Auth still knows a password-reset token (unused, not
 * expired). Asks its own link endpoint (`GET /reset-password/:token`),
 * which only checks the token and redirects — with the token when it is
 * valid, with `error=INVALID_TOKEN` otherwise. Nothing is consumed.
 */
export async function isPasswordResetTokenValid(
	token: string,
): Promise<boolean> {
	try {
		const response = await auth.api.requestPasswordResetCallback({
			params: { token },
			query: { callbackURL: "/auth/reset-password" },
			asResponse: true,
		});
		const location = response.headers.get("location");
		if (!location) return false;
		return (
			new URL(location, "http://localhost").searchParams.get("token") === token
		);
	} catch {
		return false;
	}
}

/**
 * The session read past Better Auth's cookie cache — for a page that must
 * see a change made moments before (the email change landing page).
 */
export async function getFreshSession() {
	return auth.api.getSession({
		headers: await headers(),
		query: { disableCookieCache: true },
	});
}

/**
 * Get the current user (server-side only)
 * Returns null if not authenticated
 */
export async function getCurrentUser() {
	const session = await getSession();
	return session?.user ?? null;
}
