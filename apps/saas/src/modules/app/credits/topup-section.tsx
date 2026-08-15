"use client";

import { createLogger } from "@fuutu/logs";
import { Badge, Button, Card, CardContent } from "@fuutu/ui";
import { Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { orpc } from "@/utils/orpc";

const log = createLogger({ scope: "topup-section" });

interface TopUpSectionProps {
	organizationId?: string;
}

type TopupPackage = {
	id: string;
	meterKey: string;
	amount: number;
	displayPrice: string;
	priceId: string;
	label: string;
	description?: string;
	popular?: boolean;
};

export function TopUpSection({ organizationId }: TopUpSectionProps) {
	const t = useTranslations("credits.topup");
	const [redirecting, setRedirecting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [topups, setTopups] = useState<TopupPackage[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const loadPackages = async () => {
			try {
				const result = await orpc.payments.topupPackages.list.call();
				setTopups((result as { packages: TopupPackage[] }).packages ?? []);
			} catch (err) {
				log.warn("failed to load topup packages", { err });
			} finally {
				setLoading(false);
			}
		};
		void loadPackages();
	}, []);

	const handleBuy = async (topupId: string) => {
		setRedirecting(true);
		setError(null);
		try {
			const result = await orpc.payments.topupCheckout.create.call({
				topupId,
				organizationId,
			});
			if (result && typeof result === "object" && "url" in result) {
				window.location.href = result.url as string;
			}
		} catch (err) {
			log.warn("topup checkout failed", { err });
			setError(t("unavailable"));
			setRedirecting(false);
		}
	};

	if (loading) {
		return null;
	}

	if (topups.length === 0) {
		return null;
	}

	return (
		<div className="space-y-4">
			<div>
				<h2 className="font-semibold text-lg">{t("title")}</h2>
				<p className="text-muted-foreground text-sm">{t("description")}</p>
			</div>

			{error && (
				<div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
					{error}
				</div>
			)}

			{redirecting && (
				<div className="rounded-md bg-muted p-3 text-muted-foreground text-sm">
					{t("redirecting")}
				</div>
			)}

			<div className="grid gap-4 md:grid-cols-3">
				{topups.map((topup) => (
					<Card key={topup.id} className="relative">
						{topup.popular && (
							<Badge className="absolute -top-2 right-4" variant="default">
								{t("popular")}
							</Badge>
						)}
						<CardContent className="space-y-3 p-6">
							<div className="flex items-center gap-2">
								<Zap className="size-5 text-muted-foreground" />
								<div>
									<p className="font-medium">{topup.label}</p>
									<p className="text-muted-foreground text-xs">
										{topup.description}
									</p>
								</div>
							</div>
							<div className="flex items-center justify-between">
								<span className="font-bold text-2xl">{topup.displayPrice}</span>
								<span className="text-muted-foreground text-xs">
									{t("perPackage")}
								</span>
							</div>
							<Button
								className="w-full"
								disabled={redirecting}
								onClick={() => handleBuy(topup.id)}
							>
								{t("buy")}
							</Button>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
