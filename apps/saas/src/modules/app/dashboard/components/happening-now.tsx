"use client";

import {
	type Area,
	AreaIcon,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@fuutu/ui";
import { CreditCard, KeyRound, Sparkles, Users } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { DashboardFeedItem } from "../lib/usage";

const AREA_ICONS: Record<Area, ReactNode> = {
	users: <Users />,
	billing: <CreditCard />,
	ai: <Sparkles />,
	api: <KeyRound />,
};

const KIND_KEYS: Record<DashboardFeedItem["kind"], string> = {
	"auth.sign_up": "authSignUp",
	"auth.session_created": "authSessionCreated",
	"org.create": "orgCreate",
	"org.invite": "orgInvite",
	"org.invite.accept": "orgInviteAccept",
	"audit.other": "auditOther",
	"invoice.paid": "invoicePaid",
	"invoice.open": "invoiceOpen",
	"api_key.created": "apiKeyCreated",
	"credits.consumed": "creditsConsumed",
};

export function HappeningNow({ feed }: { feed: DashboardFeedItem[] }) {
	const t = useTranslations("dashboard");
	const format = useFormatter();

	function relativeTime(iso: string): string {
		const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
		const diffH = Math.floor(diffMin / 60);
		if (diffMin < 1) return t("activity.justNow");
		if (diffMin < 60) return t("activity.minutesAgo", { n: diffMin });
		if (diffH < 24) return t("activity.hoursAgo", { n: diffH });
		return t("activity.daysAgo", { n: Math.floor(diffH / 24) });
	}

	function sentence(item: DashboardFeedItem): ReactNode {
		const key = KIND_KEYS[item.kind] ?? KIND_KEYS["audit.other"];
		const amount =
			item.amount === undefined
				? ""
				: item.currency
					? format.number(item.amount, {
							style: "currency",
							currency: item.currency,
						})
					: format.number(item.amount, {
							notation: "compact",
							maximumFractionDigits: 1,
						});
		return t.rich(`feed.kinds.${key}`, {
			b: (chunks) => <span className="font-bold">{chunks}</span>,
			actor: item.actor ?? t("feed.someone"),
			label: item.label ?? "",
			amount,
		});
	}

	return (
		<Card
			className="lg:col-span-4 lg:h-0 lg:min-h-full"
			data-testid="happening-now"
		>
			<CardHeader>
				<CardTitle className="text-base">
					<h2>{t("feed.title")}</h2>
				</CardTitle>
			</CardHeader>
			<CardContent
				className="scrollbar-soft min-h-0 flex-1 overflow-y-auto"
				role="region"
				aria-label={t("feed.title")}
				tabIndex={0}
			>
				{feed.length === 0 ? (
					<p className="text-muted-foreground text-sm">{t("feed.empty")}</p>
				) : (
					<ul className="grid gap-2">
						{feed.map((item) => (
							<li
								key={item.id}
								className="flex items-center gap-3 rounded-2xl bg-muted/60 p-2.5 pr-3"
							>
								<AreaIcon area={item.area}>{AREA_ICONS[item.area]}</AreaIcon>
								<div className="min-w-0 flex-1">
									<p className="break-words text-sm leading-5">
										{sentence(item)}
									</p>
									<time
										dateTime={item.at}
										data-volatile=""
										className="text-muted-foreground text-xs"
									>
										{relativeTime(item.at)}
									</time>
								</div>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
