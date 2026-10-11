/**
 * Credit meter catalog — the leaf module shared by @fuutu/credits
 * (balance/consume logic) and @fuutu/payments (plan grants, pricing UI).
 *
 * Kept dependency-free on purpose: payments re-exports this from
 * `@fuutu/payments/config`, which must stay client-safe.
 */

/**
 * Credit meter definition — what is being measured.
 * App-defined: add whatever your app needs to track.
 *
 * Examples:
 *   - { key: "ai_tokens", label: "AI Tokens", unit: "tokens", resetOn: "month" }
 *   - { key: "images", label: "Image Generations", unit: "count", resetOn: "month" }
 *   - { key: "api_calls", label: "API Calls", unit: "count", resetOn: "month" }
 *
 * You can have separate meters per resource type (10 images + 20 videos)
 * OR a shared meter (40 "generations" usable for either).
 */
export interface CreditMeter {
	/** Unique key — e.g. "ai_tokens", "api_calls", "images" */
	key: string;
	/** Display name for UI — e.g. "AI Tokens", "Image Generations" */
	label: string;
	/** Unit of measurement */
	unit: "count" | "tokens" | "mb" | "seconds";
	/**
	 * When does the recurring balance reset?
	 * "month" = on subscription renewal or 1st of month
	 * "year"  = annually
	 * "never" = never expires (only relevant for top-up packages)
	 */
	resetOn: "month" | "year" | "never";
	/**
	 * Allow consumption beyond the granted amount?
	 * If true, overage is tracked but not blocked.
	 * Useful for AI tokens with pay-as-you-go billing.
	 */
	allowOverage?: boolean;
}

/**
 * Credit meters — define what your app tracks.
 * Add/remove meters as needed. Each meter gets its own balance.
 */
export const CREDIT_METERS: CreditMeter[] = [
	{
		key: "ai_tokens",
		label: "AI Tokens",
		unit: "tokens",
		resetOn: "month",
		allowOverage: true,
	},
	{ key: "api_calls", label: "API Calls", unit: "count", resetOn: "month" },
	{ key: "documents", label: "Documents", unit: "count", resetOn: "month" },
];

/** Get a meter definition by key. */
export function getMeter(meterKey: string): CreditMeter | undefined {
	return CREDIT_METERS.find((m) => m.key === meterKey);
}
