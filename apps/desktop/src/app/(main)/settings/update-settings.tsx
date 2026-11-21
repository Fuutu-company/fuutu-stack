"use client";

import {
	Button,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@fuutu/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SettingsSection } from "@/components/settings-section";
import {
	checkForUpdate,
	getUpdatesStatus,
	readChannel,
	writeChannel,
} from "@/lib/updates";

/** Settings → Updates: channel + "check now" (the dialog offers the update). */
export function UpdateSettings() {
	const t = useTranslations("desktop.updates");
	const queryClient = useQueryClient();
	const status = useQuery({
		queryKey: ["desktop", "updates", "status"],
		queryFn: getUpdatesStatus,
		staleTime: Number.POSITIVE_INFINITY,
	});
	const [channel, setChannel] = useState<string | null>(readChannel);
	const [result, setResult] = useState<"none" | "found" | "error" | null>(null);
	const [checking, setChecking] = useState(false);

	if (!status.data) return null;
	const { enabled, channels, defaultChannel } = status.data;
	const current = channel ?? defaultChannel;

	async function checkNow() {
		setChecking(true);
		setResult(null);
		try {
			const update = await checkForUpdate(current);
			// The dialog (same query) shows a found update.
			queryClient.setQueryData(["desktop", "updates", "check"], update);
			setResult(update ? "found" : "none");
		} catch {
			setResult("error");
		} finally {
			setChecking(false);
		}
	}

	return (
		<SettingsSection
			title={t("title")}
			description={enabled ? t("description") : t("unavailable")}
		>
			{enabled ? (
				<div className="flex flex-col gap-4">
					{channels.length > 1 ? (
						<div className="flex flex-col gap-2">
							<Label htmlFor="update-channel">{t("channel")}</Label>
							<Select
								value={current}
								onValueChange={(value) => {
									writeChannel(value);
									setChannel(value);
									setResult(null);
								}}
							>
								<SelectTrigger id="update-channel" className="w-full sm:w-64">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{channels.map((c) => (
										<SelectItem key={c} value={c}>
											{c === "stable" || c === "beta" ? t(`channels.${c}`) : c}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					) : null}
					<div className="flex flex-wrap items-center gap-3">
						<Button
							variant="outline"
							disabled={checking}
							onClick={() => void checkNow()}
						>
							{checking ? t("checking") : t("checkNow")}
						</Button>
						{result ? (
							<p
								className={
									result === "error"
										? "text-destructive text-sm"
										: "text-muted-foreground text-sm"
								}
								role={result === "error" ? "alert" : "status"}
							>
								{t(`result.${result}`)}
							</p>
						) : null}
					</div>
				</div>
			) : null}
		</SettingsSection>
	);
}
