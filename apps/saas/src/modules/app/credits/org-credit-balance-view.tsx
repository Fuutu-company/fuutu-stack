"use client";

import { authClient } from "@fuutu/auth/client";
import { createLogger } from "@fuutu/logs";
import { Badge, Button, Card, CardContent, Progress } from "@fuutu/ui";
import { Coins } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { orpc } from "@/utils/orpc";
import { TopUpSection } from "./topup-section";

const log = createLogger({ scope: "org-credit-balance-view" });

type CreditBalanceSummary = {
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
};

type CreditEvent = {
	id: string;
	meterKey: string;
	amount: number;
	source: string;
	createdAt: Date;
};

interface OrgCreditBalanceViewProps {
	slug: string;
}

export function OrgCreditBalanceView({ slug }: OrgCreditBalanceViewProps) {
	const t = useTranslations("credits");
	const { data: activeOrg } = authClient.useActiveOrganization();
	const [balances, setBalances] = useState<CreditBalanceSummary[]>([]);
	const [history, setHistory] = useState<CreditEvent[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			if (!activeOrg?.id) return;

			const [balanceRes, historyRes] = await Promise.all([
				orpc.credits.balance.call({ organizationId: activeOrg.id }),
				orpc.credits.history.call({ organizationId: activeOrg.id }),
			]);
			setBalances(
				(balanceRes as { balances: CreditBalanceSummary[] }).balances ?? [],
			);
			setHistory((historyRes as { events: CreditEvent[] }).events ?? []);
		} catch (err) {
			log.warn("org credits fetch failed", { err });
			setError("Failed to load credits");
		} finally {
			setLoading(false);
		}
	}, [activeOrg?.id]);

	useEffect(() => {
		void load();
	}, [load]);

	if (loading) {
		return <p className="text-muted-foreground text-sm">{t("title")}</p>;
	}

	if (error) {
		return (
			<div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
				{error}
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-bold text-3xl tracking-tight">{t("title")}</h1>
				<p className="mt-2 text-muted-foreground">{t("description")}</p>
			</div>

			{balances.length === 0 ? (
				<Card>
					<CardContent className="p-6 md:p-8">
						<p className="text-muted-foreground text-sm">
							No credit balances configured.
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-6 md:grid-cols-2">
					{balances.map((balance) => (
						<Card key={balance.meterKey}>
							<CardContent className="space-y-4 p-6 md:p-8">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-3">
										<Coins className="size-5 text-muted-foreground" />
										<div>
											<p className="font-medium">{balance.label}</p>
											<p className="text-muted-foreground text-xs">
												{t("total")}: {t("remaining", { count: balance.total })}
											</p>
										</div>
									</div>
									<Badge variant="secondary">
										{balance.total} {balance.unit}
									</Badge>
								</div>

								<div className="space-y-2">
									<div className="flex items-center justify-between text-sm">
										<span className="text-muted-foreground">
											{t("recurring")}
										</span>
										<span className="font-medium">
											{t("of", {
												used: balance.recurring.consumed,
												total: balance.recurring.granted,
											})}
										</span>
									</div>
									<Progress
										value={
											balance.recurring.granted > 0
												? (balance.recurring.consumed /
														balance.recurring.granted) *
													100
												: 0
										}
										className="h-2"
									/>
								</div>

								{balance.topups.packageCount > 0 && (
									<div className="space-y-2">
										<div className="flex items-center justify-between text-sm">
											<span className="text-muted-foreground">
												{t("topups")}
											</span>
											<span className="font-medium">
												{t("packages", { count: balance.topups.packageCount })}
											</span>
										</div>
										<div className="flex items-center justify-between text-sm">
											<span className="text-muted-foreground">
												{t("remainingLabel")}
											</span>
											<span className="font-medium">
												{balance.topups.remaining} {balance.unit}
											</span>
										</div>
									</div>
								)}

								<Button asChild className="w-full">
									<a href={`/organizations/${slug}/settings/billing`}>
										{t("buyMore")}
									</a>
								</Button>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			<TopUpSection organizationId={activeOrg?.id} />

			<Card>
				<CardContent className="space-y-4 p-6 md:p-8">
					<h2 className="font-semibold text-lg">{t("history")}</h2>
					{history.length === 0 ? (
						<p className="text-muted-foreground text-sm">{t("noHistory")}</p>
					) : (
						<div className="space-y-2">
							{history.map((event) => (
								<div
									key={event.id}
									className="flex items-center justify-between rounded-lg border p-3"
								>
									<div>
										<p className="font-medium text-sm">
											{t(`source.${event.source}`) || event.source}
										</p>
										<p className="text-muted-foreground text-xs">
											{new Date(event.createdAt).toLocaleString()}
										</p>
									</div>
									<Badge variant={event.amount > 0 ? "default" : "destructive"}>
										{event.amount > 0 ? "+" : ""}
										{event.amount}
									</Badge>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
