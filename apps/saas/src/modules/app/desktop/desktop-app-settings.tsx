"use client";

import { createLogger } from "@fuutu/logs";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	PageHeader,
	Skeleton,
} from "@fuutu/ui";
import { useQuery } from "@tanstack/react-query";
import { Download, Monitor } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useImpersonating } from "@/lib/use-impersonating";
import { ImpersonationNotice } from "@/modules/app/components/impersonation-notice";
import { orpc } from "@/utils/orpc";

const log = createLogger({ scope: "desktop-devices" });

function RevokeDevice({
	deviceId,
	disabled,
	onRevoked,
}: {
	deviceId: string;
	disabled: boolean;
	onRevoked: () => void;
}) {
	const t = useTranslations("desktopApp.devices");
	const tCommon = useTranslations("common");
	const [open, setOpen] = useState(false);
	const [revoking, setRevoking] = useState(false);

	async function revoke() {
		setRevoking(true);
		try {
			await orpc.desktop.devices.revoke.call({ deviceId });
			setOpen(false);
			onRevoked();
		} catch (err) {
			log.error("desktop device revoke failed", { err });
			toast.error(t("revokeError"));
		} finally {
			setRevoking(false);
		}
	}

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger asChild>
				<Button variant="ghost" size="sm" disabled={disabled}>
					{t("revoke")}
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t("revokeTitle")}</AlertDialogTitle>
					<AlertDialogDescription>
						{t("revokeDescription")}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
					<AlertDialogAction
						onClick={revoke}
						disabled={revoking}
						variant="destructive"
					>
						{revoking ? t("revoking") : t("revoke")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

const PLATFORMS = ["macos", "windows", "linux"] as const;
type Platform = (typeof PLATFORMS)[number];

/** Installers of the current release (`GET /api/desktop/download`). */
async function fetchRelease(): Promise<{
	version: string | null;
	platforms: Platform[];
}> {
	const res = await fetch("/api/desktop/download");
	if (!res.ok) throw new Error(`release ${res.status}`);
	return res.json();
}

function DownloadCard() {
	const t = useTranslations("desktopApp.download");
	const release = useQuery({
		queryKey: ["desktop", "release"],
		queryFn: fetchRelease,
	});
	const platforms = release.data?.platforms ?? [];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("title")}</CardTitle>
				<CardDescription>
					{release.data?.version
						? t("version", { version: release.data.version })
						: null}{" "}
					{t("description")}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-wrap gap-3">
				{release.isPending ? (
					<Skeleton className="h-9 w-64" />
				) : platforms.length === 0 ? (
					<p className="text-muted-foreground text-sm">{t("unavailable")}</p>
				) : (
					platforms.map((platform) => (
						<Button key={platform} variant="outline" asChild>
							<a href={`/api/desktop/download/${platform}`}>
								<Download aria-hidden />
								{t(platform)}
							</a>
						</Button>
					))
				)}
			</CardContent>
		</Card>
	);
}

/** Account settings → Desktop app: download + the signed-in devices. */
export function DesktopAppSettings() {
	const t = useTranslations("desktopApp");
	const format = useFormatter();
	const impersonating = useImpersonating();
	const devices = useQuery(orpc.desktop.devices.list.queryOptions());
	const date = (value: Date) => format.dateTime(value, { dateStyle: "medium" });

	return (
		<>
			<PageHeader variant="compact" title={t("title")} />
			<p className="text-muted-foreground text-sm">{t("description")}</p>
			<DownloadCard />
			<Card>
				<CardHeader>
					<CardTitle>{t("devices.title")}</CardTitle>
					<CardDescription>
						{t("devices.description")}{" "}
						{devices.data
							? devices.data.limit === null
								? t("devices.count", { count: devices.data.devices.length })
								: t("devices.limit", {
										count: devices.data.devices.length,
										limit: devices.data.limit,
									})
							: null}
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-3">
					{impersonating ? <ImpersonationNotice /> : null}
					{devices.isPending ? (
						<Skeleton className="h-16 w-full" />
					) : devices.isError ? (
						<p className="text-destructive text-sm" role="alert">
							{t("loadError")}
						</p>
					) : devices.data.devices.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							{t("devices.empty")}
						</p>
					) : (
						<ul className="divide-y divide-border">
							{devices.data.devices.map((device) => (
								<li key={device.id} className="flex items-center gap-3 py-3">
									<Monitor
										className="size-5 text-muted-foreground"
										aria-hidden
									/>
									<div className="min-w-0 flex-1 text-sm">
										<p>
											{t("devices.signedInAt", {
												date: date(device.signedInAt),
											})}
										</p>
										<p className="text-muted-foreground">
											{t("devices.lastActiveAt", {
												date: date(device.lastActiveAt),
											})}
										</p>
									</div>
									<RevokeDevice
										deviceId={device.id}
										disabled={impersonating}
										onRevoked={() => void devices.refetch()}
									/>
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>
		</>
	);
}
