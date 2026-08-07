"use client";

import { createLogger } from "@fuutu/logs";
import { cn } from "@fuutu/ui";
import {
	AlertCircle,
	AlertTriangle,
	CheckCircle2,
	Info,
	type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";

type Notification = {
	id: string;
	type: string;
	title: string;
	body: string;
	readAt: Date | null;
	createdAt: Date;
};

const TYPE_ICONS: Record<string, LucideIcon> = {
	info: Info,
	success: CheckCircle2,
	warning: AlertTriangle,
	error: AlertCircle,
};

const TYPE_COLORS: Record<string, string> = {
	info: "text-primary",
	success: "text-success",
	warning: "text-muted-foreground",
	error: "text-destructive",
};

const log = createLogger({ scope: "notification-item" });

export function NotificationItem({
	notification,
	onRead,
}: {
	notification: Notification;
	onRead: () => void;
}) {
	const t = useTranslations("notifications");
	const locale = useLocale();
	const Icon = TYPE_ICONS[notification.type] ?? Info;
	const isUnread = notification.readAt === null;

	async function handleClick() {
		if (!isUnread) return;
		try {
			await orpc.notifications.markRead.call({ id: notification.id });
			onRead();
		} catch (e) {
			log.error("mark read failed", { err: e });
			toast.error(t("markReadError"));
		}
	}

	return (
		<button
			type="button"
			onClick={handleClick}
			className={cn(
				"flex w-full items-start gap-3 border-b p-4 text-left transition-colors hover:bg-muted/50",
				isUnread && "bg-primary/5",
			)}
		>
			<Icon
				className={cn(
					"mt-0.5 size-5 shrink-0",
					TYPE_COLORS[notification.type] ?? "text-muted-foreground",
				)}
			/>
			<div className="flex-1 space-y-1">
				<div className="flex items-center gap-2">
					<p className="font-medium text-sm">{notification.title}</p>
					{isUnread && (
						<span className="size-2 shrink-0 rounded-full bg-primary" />
					)}
				</div>
				<p className="text-muted-foreground text-sm">{notification.body}</p>
				<p className="text-muted-foreground text-xs">
					{notification.createdAt.toLocaleString(locale)}
				</p>
			</div>
		</button>
	);
}
