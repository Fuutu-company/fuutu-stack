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
