import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import {
	isProviderRequestError,
	PaymentsDisabledError,
	type ProviderFailureKind,
	WebhookConfigError,
} from "@fuutu/payments";
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
 * The client code of each provider failure; `data.reason` carries the kind
 * so the UI can say what happened.
 */
const PROVIDER_FAILURE_CODE = {
	not_found: "PRECONDITION_FAILED",
	invalid_state: "CONFLICT",
	rejected: "BAD_REQUEST",
	unavailable: "SERVICE_UNAVAILABLE",
} as const satisfies Record<ProviderFailureKind, string>;

/**
 * Map typed provider failures to clean client errors:
 * - `PaymentsDisabledError` (inactive/skeleton provider) → 501
 * - `WebhookConfigError` (missing or rejected API key, missing
 *   customProvider, bad return URL) → 503 "Payments are not configured",
 *   `data.reason` "not_configured" — the details name env vars, so they go
 *   to the log only.
 * - `ProviderRequestError` → by kind (`PROVIDER_FAILURE_CODE`), with
 *   `data.reason` = the kind; the provider's own messages stay in the log.
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
			data: { reason: "not_configured" },
		});
	}
	if (isProviderRequestError(err)) {
		log.warn("payment provider request failed", {
			kind: err.kind,
			status: err.status,
			err: err.message,
		});
		throw new ORPCError(PROVIDER_FAILURE_CODE[err.kind], {
			message: "The payment provider could not complete this request",
			data: { reason: err.kind },
		});
	}
	throw err;
}
