import { auth } from "@fuutu/auth";
import { isAdmin, type UserWithRole } from "@fuutu/auth/types";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

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

	if (!isAdmin(session.user as UserWithRole)) {
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
	const user = session.user as UserWithRole & { onboardingComplete?: boolean };
	if (user.onboardingComplete === false) {
		const pathname = (await headers()).get("x-pathname") ?? "";
		if (!pathname.startsWith("/onboarding")) {
			redirect("/onboarding");
		}
	}
	return session;
}

/**
 * Get the current user (server-side only)
 * Returns null if not authenticated
 */
export async function getCurrentUser() {
	const session = await getSession();
	return session?.user ?? null;
}
