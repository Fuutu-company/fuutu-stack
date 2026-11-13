import type { AppRouterClient } from "@fuutu/api";
import type { LimitValue } from "@fuutu/payments/features";

export type DashboardOverviewData = Awaited<
	ReturnType<AppRouterClient["dashboard"]["overview"]>
>;

export type DashboardFeedItem = DashboardOverviewData["feed"][number];

/** ICU `select` params for a plan limit: `{limit, select, unlimited {…} disabled {…} other {… {max}}}`. */
export function limitParams(limit: LimitValue): {
	limit: "unlimited" | "disabled" | "limited";
	max: number;
} {
	if (limit === "unlimited") return { limit: "unlimited", max: 0 };
	if (limit === false) return { limit: "disabled", max: 0 };
	return { limit: "limited", max: limit };
}

/**
 * Token totals for the AI tile and meter. The base is what was actually
 * granted (plan allowance plus top-ups); only a never-granted balance
 * falls back to the plan's included amount.
 */
export function creditTotals(credits: {
	remaining: number;
	granted: number;
	included: LimitValue;
}): { total: number; used: number; hasBalance: boolean } {
	const included = typeof credits.included === "number" ? credits.included : 0;
	const hasBalance = credits.granted > 0 || credits.remaining > 0;
	const total = credits.granted > 0 ? credits.granted : included;
	return {
		total,
		used: Math.max(0, total - credits.remaining),
		hasBalance,
	};
}
