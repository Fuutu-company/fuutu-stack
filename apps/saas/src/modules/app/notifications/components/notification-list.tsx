"use client";

import { createLogger } from "@fuutu/logs";
import { Button, Card, CardContent } from "@fuutu/ui";
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
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="font-bold text-3xl tracking-tight">{t("title")}</h1>
					<p className="mt-2 text-muted-foreground text-sm">
						{t("description")}
					</p>
				</div>
				{hasUnread && (
					<Button variant="outline" size="sm" onClick={markAllRead}>
						{t("markAllRead")}
					</Button>
				)}
			</div>

			{query.isLoading ? (
				<p className="text-muted-foreground text-sm">{t("loading")}</p>
			) : items.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
						<Bell className="size-8 text-muted-foreground" />
						<p className="font-medium text-sm">{t("empty")}</p>
						<p className="text-muted-foreground text-sm">
							{t("emptyDescription")}
						</p>
					</CardContent>
				</Card>
			) : (
				<Card>
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
