import type { ProviderFailureKind } from "@fuutu/payments";
import { ORPCError } from "@orpc/client";
import type { useTranslations } from "next-intl";

export type SeatLimit = { seatsTotal: number; upgradeUrl: string };

/**
 * The org's seat cap when `err` is the API's typed seat-limit error
 * (`PAYMENT_REQUIRED`, data `{ seatsTotal, upgradeUrl }`), else null.
 */
export function seatLimitFromError(err: unknown): SeatLimit | null {
	if (!(err instanceof ORPCError) || err.code !== "PAYMENT_REQUIRED") {
		return null;
	}
	const data: unknown = err.data;
	if (typeof data !== "object" || data === null) return null;
	const { seatsTotal, upgradeUrl } = data as Record<string, unknown>;
	return typeof seatsTotal === "number" && typeof upgradeUrl === "string"
		? { seatsTotal, upgradeUrl }
		: null;
}

/**
 * Map an API error to a localized message. The API's authorize middleware
 * reports plan gates with stable English messages ("Limit exceeded (n/m)",
 * "not available on your plan") — those must be translated client-side,
 * so this maps them to `common.errors.*` keys instead of leaking raw
 * server strings. Everything else falls back to the caller's generic key.
 */
export function planGateMessage(
	err: unknown,
	t: ReturnType<typeof useTranslations>,
	fallbackKey: Parameters<ReturnType<typeof useTranslations>>[0],
): string {
	const message = err instanceof Error ? err.message : "";
	if (message.includes("Limit exceeded")) {
		return t("common.errors.planLimitReached");
	}
	if (
		message.includes("not available on your plan") ||
		message.includes("requires a higher plan")
	) {
		return t("common.errors.planFeatureRequired");
	}
	return t(fallbackKey);
}

/** `payments.*` message of each provider failure the API reports. */
const PROVIDER_FAILURE_KEY = {
	not_found: "errors.providerNotFound",
	invalid_state: "errors.providerStateConflict",
	rejected: "errors.providerRejected",
	unavailable: "errors.providerUnavailable",
} as const satisfies Record<ProviderFailureKind, string>;

/**
 * The provider failure behind a payments error (`data.reason`, set by the
 * API for a typed provider failure), else null.
 */
function providerFailure(err: unknown): ProviderFailureKind | null {
	if (!(err instanceof ORPCError)) return null;
	const data: unknown = err.data;
	if (typeof data !== "object" || data === null) return null;
	const { reason } = data as Record<string, unknown>;
	return typeof reason === "string" &&
		Object.hasOwn(PROVIDER_FAILURE_KEY, reason)
		? (reason as ProviderFailureKind)
		: null;
}

/**
 * True when a payments call failed because the deployment cannot take
 * payments — provider off (`NOT_IMPLEMENTED`) or misconfigured, e.g. a
 * missing or rejected API key (`SERVICE_UNAVAILABLE`). A provider that
 * can't be reached is a `SERVICE_UNAVAILABLE` too, but with a provider
 * failure reason — not this. The UI says so instead of a generic
 * "checkout failed".
 */
export function isPaymentsUnavailable(err: unknown): boolean {
	return (
		err instanceof ORPCError &&
		(err.code === "NOT_IMPLEMENTED" ||
			(err.code === "SERVICE_UNAVAILABLE" && providerFailure(err) === null))
	);
}

/**
 * The `payments.*` message key for a failed payments call: what the
 * provider said (unknown subscription, state changed, declined,
 * unreachable) or that payments are not configured; null for anything
 * else — the caller shows its own fallback.
 */
export function paymentsErrorKey(
	err: unknown,
):
	| (typeof PROVIDER_FAILURE_KEY)[ProviderFailureKind]
	| "choosePlan.unavailable"
	| null {
	const failure = providerFailure(err);
	if (failure) return PROVIDER_FAILURE_KEY[failure];
	return isPaymentsUnavailable(err) ? "choosePlan.unavailable" : null;
}

/**
 * True when the API refused an AI request because the caller's AI credit
 * meter is used up (`PAYMENT_REQUIRED`, data `{ meterKey: "ai_tokens" }`).
 */
export function isAiCreditsExhausted(err: unknown): boolean {
	if (!(err instanceof ORPCError) || err.code !== "PAYMENT_REQUIRED") {
		return false;
	}
	const data: unknown = err.data;
	return (
		typeof data === "object" &&
		data !== null &&
		(data as Record<string, unknown>).meterKey === "ai_tokens"
	);
}
