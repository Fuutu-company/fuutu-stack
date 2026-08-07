"use client";

import { Skeleton } from "@fuutu/ui";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { orpc } from "@/utils/orpc";

const ACTION_I18N_KEYS: Record<string, string> = {
	"auth.sign_up": "activity.signedUp",
	"auth.session_created": "activity.sessionCreated",
	"organization.create": "activity.createdOrg",
	"organization.invite": "activity.invitedMember",
	"organization.accept_invitation": "activity.acceptedInvite",
	"payment.planChange": "activity.changedPlan",
	"role.change": "activity.changedRole",
	"locale.switch": "activity.switchedLocale",
	"user.updateProfile": "activity.updatedProfile",
	"user.verifyEmail": "activity.verifiedEmail",
};

export function RecentActivity() {
	const t = useTranslations("dashboard");
	const { data, isPending, isError } = useQuery(
		orpc.activity.recent.queryOptions(),
	);
	const items = data?.items ?? [];

	function formatRelativeTime(date: Date | string): string {
		const now = new Date();
		const past = new Date(date);
		const diffMs = now.getTime() - past.getTime();
		const diffMin = Math.floor(diffMs / 60000);
		const diffH = Math.floor(diffMin / 60);
		const diffD = Math.floor(diffH / 24);
		if (diffMin < 1) return t("activity.justNow");
		if (diffMin < 60) return t("activity.minutesAgo", { n: diffMin });
		if (diffH < 24) return t("activity.hoursAgo", { n: diffH });
		return t("activity.daysAgo", { n: diffD });
	}

	return (
		<div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
			<h3 className="mb-4 font-semibold text-lg">{t("activity.title")}</h3>
			{isPending ? (
				<div className="space-y-4">
					{Array.from({ length: 5 }).map((_, i) => (
						<Skeleton key={i} className="h-12 w-full" />
					))}
				</div>
			) : isError ? (
				<p className="text-destructive text-sm">{t("activity.error")}</p>
			) : items.length === 0 ? (
				<p className="text-muted-foreground text-sm">{t("activity.empty")}</p>
			) : (
				<div className="space-y-4">
					{items.map((item) => {
						const actionKey = ACTION_I18N_KEYS[item.action];
						const userName =
							item.user?.name ?? item.user?.email ?? t("activity.unknownUser");
						return (
							<div
								key={item.id}
								className="flex items-start justify-between border-b pb-4 last:border-0 last:pb-0"
							>
								<div className="flex-1">
									<p className="text-sm">
										<span className="font-medium">{userName}</span>{" "}
										<span className="text-muted-foreground">
											{actionKey ? t(actionKey) : t("activity.unknownAction")}
										</span>
									</p>
									<p className="mt-1 text-muted-foreground text-xs">
										{formatRelativeTime(item.createdAt)}
									</p>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
