import { env } from "@fuutu/env/saas";
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
