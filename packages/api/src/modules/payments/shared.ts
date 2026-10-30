import { env } from "@fuutu/env/saas";
import { PaymentsDisabledError } from "@fuutu/payments";
import { getBaseUrl, getSafeRedirect } from "@fuutu/utils";
import { ORPCError } from "@orpc/server";

export function sanitizePaymentUrl(
	url: string | undefined,
): string | undefined {
	if (!url) return undefined;
	// getBaseUrl() only knows VERCEL_URL/PORT — on every other deployment
	// (Docker, Railway, custom host) it yields localhost and legitimate
	// absolute success/cancel URLs would be rejected. The canonical public
	// URL is NEXT_PUBLIC_SAAS_URL, with BETTER_AUTH_URL as fallback.
	const base = env.NEXT_PUBLIC_SAAS_URL ?? env.BETTER_AUTH_URL ?? getBaseUrl();
	const safe = getSafeRedirect(url, { allowedOrigins: [base] });
	return safe.startsWith("/") ? `${base}${safe}` : safe;
}

/**
 * Inactive/skeleton payment providers reject with `PaymentsDisabledError`.
 * Map it to a clean 501 so clients can show "payments not enabled" instead
 * of a generic server error. Any other error is rethrown unchanged.
 */
export function throwIfPaymentsDisabled(err: unknown): never {
	if (err instanceof PaymentsDisabledError) {
		throw new ORPCError("NOT_IMPLEMENTED", {
			message: "Payments are not enabled on this deployment",
		});
	}
	throw err;
}
