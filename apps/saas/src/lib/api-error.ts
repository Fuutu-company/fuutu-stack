import type { useTranslations } from "next-intl";

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
