import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import { PaymentsDisabledError, WebhookConfigError } from "@fuutu/payments";
import { getBaseUrl, getSafeRedirect } from "@fuutu/utils";
import { ORPCError } from "@orpc/server";

const log = createLogger({ scope: "api:payments" });

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
 * Map typed provider failures to clean client errors:
 * - `PaymentsDisabledError` (inactive/skeleton provider) → 501
 * - `WebhookConfigError` (missing API key, missing customProvider, bad
 *   return URL) → 503 "Payments are not configured" — the details name env
 *   vars, so they go to the log only.
 * Any other error is rethrown unchanged.
 */
export function throwIfPaymentsDisabled(err: unknown): never {
	if (err instanceof PaymentsDisabledError) {
		throw new ORPCError("NOT_IMPLEMENTED", {
			message: "Payments are not enabled on this deployment",
		});
	}
	if (err instanceof WebhookConfigError) {
		log.error("payment provider misconfigured", { err });
		throw new ORPCError("SERVICE_UNAVAILABLE", {
			message: "Payments are not configured",
		});
	}
	throw err;
}
