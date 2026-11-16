import type { AnalyticsProvider } from "./types";

/**
 * How an already-loaded provider script is stopped when consent is
 * withdrawn:
 * - `gate`: the provider's `installConsentGate` makes its script ask
 *   before every send.
 * - `reload`: the script cannot be told — <AnalyticsScript /> reloads the
 *   page, and the reloaded page injects no script without consent.
 * - `none`: the provider injects no script.
 */
export function consentWithdrawalStrategy(
	provider: AnalyticsProvider,
): "gate" | "reload" | "none" {
	if (provider.installConsentGate) return "gate";
	if (provider.getScriptProps) return "reload";
	return "none";
}

/**
 * True when consent went from granted to not granted while an ungated
 * provider script is injected — only a page reload removes it.
 */
export function needsReloadOnConsentChange(
	provider: AnalyticsProvider,
	previous: boolean,
	next: boolean,
): boolean {
	if (!previous || next) return false;
	if (consentWithdrawalStrategy(provider) !== "reload") return false;
	return (provider.getScriptProps?.() ?? null) !== null;
}
