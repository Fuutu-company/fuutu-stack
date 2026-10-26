import { env } from "@fuutu/env/public";
import { getSafeRedirect as safeRedirect } from "@fuutu/utils/redirect";
import { authConfig } from "./config";

/**
 * Auth-scoped wrapper around the canonical `@fuutu/utils/redirect` helper.
 * Supplies the auth-specific fallback (`afterSignIn`) and the
 * same-origin allow-list derived from `env.NEXT_PUBLIC_SAAS_URL`.
 *
 * Prefer this helper inside `apps/saas/src/modules/auth/*` so the fallback
 * stays consistent. For non-auth flows call `@fuutu/utils/redirect` directly
 * with your own `fallback`.
 */
export function getSafeRedirect(redirect: string | null | undefined): string {
	const allowedOrigins = [env.NEXT_PUBLIC_SAAS_URL].filter(
		(origin): origin is string => Boolean(origin),
	);

	return safeRedirect(redirect, {
		fallback: authConfig.redirects.afterSignIn,
		allowedOrigins,
	});
}

/**
 * Invitation-bound sign-up helper: returns the invitation id when the
 * redirect target is the accept-invitation page, else null.
 *
 * Always pass the SANITIZED target (`getSafeRedirect` output) — parsing
 * the raw `redirect` param would forward an invitation id from a URL the
 * sanitizer rejected (e.g. an external `https://evil/auth/accept-invitation?id=x`
 * that falls back to the default redirect).
 */
export function extractInvitationId(
	redirectTo: string | null | undefined,
): string | null {
	if (!redirectTo) return null;
	try {
		const url = new URL(redirectTo, "http://localhost");
		return url.pathname.replace(/\/$/, "") === "/auth/accept-invitation"
			? url.searchParams.get("id")
			: null;
	} catch {
		return null;
	}
}
