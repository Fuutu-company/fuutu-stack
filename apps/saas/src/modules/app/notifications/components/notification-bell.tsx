"use client";

import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@fuutu/ui";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { orpc } from "@/utils/orpc";

export function NotificationBell() {
	const t = useTranslations("notifications");

	const unreadQuery = useQuery(
		orpc.notifications.unreadCount.queryOptions({
			input: {},
			refetchInterval: 30000,
		}),
	);

	const listQuery = useQuery(
		orpc.notifications.list.queryOptions({
			input: { page: 1, limit: 5 },
			refetchInterval: 30000,
		}),
	);

	const unreadCount = unreadQuery.data?.count ?? 0;
	const recentNotifications = listQuery.data?.items ?? [];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="relative"
					aria-label={t("bellAria")}
				>
					<Bell className="size-4" />
					{unreadCount > 0 && (
						<span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary font-bold text-[10px] text-primary-foreground">
							{unreadCount > 9 ? t("moreThanNine") : unreadCount}
						</span>
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-80">
				<DropdownMenuLabel>{t("title")}</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{recentNotifications.length === 0 ? (
					<DropdownMenuItem disabled>{t("empty")}</DropdownMenuItem>
				) : (
					recentNotifications.map((notification) => (
						<DropdownMenuItem
							key={notification.id}
							className="flex-col items-start gap-1 py-2"
						>
							<div className="flex w-full items-center gap-2">
								<p className="flex-1 truncate font-medium text-sm">
									{notification.title}
								</p>
								{notification.readAt === null && (
									<span className="size-2 shrink-0 rounded-full bg-primary" />
								)}
							</div>
							<p className="w-full truncate text-muted-foreground text-xs">
								{notification.body}
							</p>
						</DropdownMenuItem>
					))
				)}
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link href="/notifications">{t("viewAll")}</Link>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
