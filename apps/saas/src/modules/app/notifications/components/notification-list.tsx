"use client";

import { createLogger } from "@fuutu/logs";
import { Button, Card, CardContent, PageHeader } from "@fuutu/ui";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";
import { NotificationItem } from "./notification-item";

const log = createLogger({ scope: "notification-list" });

export function NotificationList() {
	const t = useTranslations("notifications");
	const query = useQuery(
		orpc.notifications.list.queryOptions({
			input: { page: 1, limit: 50 },
			refetchInterval: 30000,
		}),
	);

	const items = query.data?.items ?? [];

	async function markAllRead() {
		try {
			await orpc.notifications.markAllRead.call();
			void query.refetch();
		} catch (e) {
			log.error("mark all read failed", { err: e });
			toast.error(t("markAllReadError"));
		}
	}

	const hasUnread = items.some((n) => n.readAt === null);

	return (
		<div className="space-y-6">
			<PageHeader
				variant="compact"
				title={t("title")}
				actions={
					hasUnread && (
						<Button variant="outline" size="sm" onClick={markAllRead}>
							{t("markAllRead")}
						</Button>
					)
				}
			/>

			{query.isLoading ? (
				<p className="text-muted-foreground text-sm">{t("loading")}</p>
			) : items.length === 0 ? (
				<Card className="py-0">
					<CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
						<span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
							<Bell className="size-[1.125rem]" />
						</span>
						<p className="font-bold font-heading">{t("empty")}</p>
						<p className="text-muted-foreground text-sm">
							{t("emptyDescription")}
						</p>
					</CardContent>
				</Card>
			) : (
				<Card className="overflow-hidden py-0">
					<CardContent className="p-0">
						{items.map((notification) => (
							<NotificationItem
								key={notification.id}
								notification={notification}
								onRead={() => void query.refetch()}
							/>
						))}
					</CardContent>
				</Card>
			)}
		</div>
	);
}
