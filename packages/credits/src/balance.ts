import {
	getActiveCreditPackages,
	getCreditBalancesForOrganization,
	getCreditBalancesForUser,
} from "@fuutu/db";
import { CREDIT_METERS } from "@fuutu/payments/config";

export interface CreditBalanceSummary {
	meterKey: string;
	label: string;
	unit: string;
	recurring: {
		granted: number;
		consumed: number;
		remaining: number;
		periodEnd: Date | null;
	};
	topups: {
		total: number;
		consumed: number;
		remaining: number;
		packageCount: number;
	};
	total: number;
}

export async function getCreditBalanceSummary(params: {
	userId?: string;
	organizationId?: string;
}): Promise<CreditBalanceSummary[]> {
	const { userId, organizationId } = params;
	const balances = userId
		? await getCreditBalancesForUser(userId)
		: organizationId
			? await getCreditBalancesForOrganization(organizationId)
			: [];

	const summaries: CreditBalanceSummary[] = [];

	for (const meter of CREDIT_METERS) {
		const balance = balances.find((b) => b.meterKey === meter.key);
		const packages = await getActiveCreditPackages({
			userId,
			organizationId,
			meterKey: meter.key,
		});
		const topupTotal = packages.reduce((s, p) => s + p.amount, 0);
		const topupConsumed = packages.reduce((s, p) => s + p.consumed, 0);
		const topupRemaining = packages.reduce((s, p) => s + p.remaining, 0);

		const recurringGranted = balance?.recurringGranted ?? 0;
		const recurringConsumed = balance?.recurringConsumed ?? 0;
		const recurringRemaining = Math.max(
			0,
			recurringGranted - recurringConsumed,
		);

		summaries.push({
			meterKey: meter.key,
			label: meter.label,
			unit: meter.unit,
			recurring: {
				granted: recurringGranted,
				consumed: recurringConsumed,
				remaining: recurringRemaining,
				periodEnd: balance?.recurringPeriodEnd ?? null,
			},
			topups: {
				total: topupTotal,
				consumed: topupConsumed,
				remaining: topupRemaining,
				packageCount: packages.length,
			},
			total: recurringRemaining + topupRemaining,
		});
	}

	return summaries;
}
