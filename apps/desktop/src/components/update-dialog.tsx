"use client";

import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Progress,
} from "@fuutu/ui";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { logError } from "@/lib/desktop";
import {
	checkForUpdate,
	DEBUG_NOT_INSTALLED,
	getUpdatesStatus,
	installUpdate,
	readChannel,
	type UpdateInfo,
	type UpdateProgress,
} from "@/lib/updates";

const HOUR_MS = 3_600_000;

/**
 * Checks for updates at start and every `updates.checkIntervalHours`;
 * offers a found version in a dialog (install + restart, or later).
 */
export function UpdateDialog() {
	const t = useTranslations("desktop.updates");
	const status = useQuery({
		queryKey: ["desktop", "updates", "status"],
		queryFn: getUpdatesStatus,
		staleTime: Number.POSITIVE_INFINITY,
	});
	const enabled = status.data?.enabled === true;
	const check = useQuery({
		queryKey: ["desktop", "updates", "check"],
		queryFn: () => checkForUpdate(readChannel()),
		enabled,
		retry: false,
		refetchOnWindowFocus: false,
		refetchInterval: enabled
			? Math.max(1, status.data?.checkIntervalHours ?? 6) * HOUR_MS
			: false,
	});
	const [dismissed, setDismissed] = useState<string | null>(null);
	const [progress, setProgress] = useState<UpdateProgress | null>(null);
	const [result, setResult] = useState<"failed" | "debugVerified" | null>(null);

	useEffect(() => {
		if (check.error) void logError("update check failed", check.error);
	}, [check.error]);

	const update: UpdateInfo | null | undefined = check.data;
	if (!update || dismissed === update.version) return null;

	const percent =
		progress?.total && progress.total > 0
			? Math.round((progress.downloaded / progress.total) * 100)
			: null;

	async function install() {
		setResult(null);
		setProgress({ downloaded: 0, total: null });
		try {
			await installUpdate(setProgress);
		} catch (err) {
			setProgress(null);
			if (err === DEBUG_NOT_INSTALLED) {
				setResult("debugVerified");
				return;
			}
			void logError("update install failed", err);
			setResult("failed");
		}
	}

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !progress) setDismissed(update.version);
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{t("available.title", { version: update.version })}
					</DialogTitle>
					<DialogDescription>
						{t("available.description", { current: update.currentVersion })}
					</DialogDescription>
				</DialogHeader>
				{update.notes ? (
					<p className="max-h-48 overflow-y-auto whitespace-pre-line text-sm">
						{update.notes}
					</p>
				) : null}
				{progress ? (
					<div className="flex flex-col gap-2" aria-live="polite">
						<Progress value={percent ?? undefined} />
						<p className="text-muted-foreground text-sm">
							{percent === null ? t("downloading") : t("progress", { percent })}
						</p>
					</div>
				) : null}
				{result === "failed" ? (
					<p className="text-destructive text-sm" role="alert">
						{t("failed")}
					</p>
				) : null}
				{result === "debugVerified" ? (
					<p className="text-muted-foreground text-sm" role="status">
						{t("debugVerified")}
					</p>
				) : null}
				<DialogFooter>
					<Button
						variant="outline"
						disabled={progress !== null}
						onClick={() => setDismissed(update.version)}
					>
						{t("later")}
					</Button>
					<Button disabled={progress !== null} onClick={() => void install()}>
						{t("install")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
