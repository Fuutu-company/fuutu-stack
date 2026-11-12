"use client";

import { authClient } from "@fuutu/auth/client";
import type { ConnectedApp } from "@fuutu/auth/plugins/mcp-connected-apps";
import { config } from "@fuutu/config";
import { createLogger } from "@fuutu/logs";
import { Badge, Button } from "@fuutu/ui";
import { PlugZap, ShieldAlert } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

const log = createLogger({ scope: "settings-connected-apps" });

/** OAuth clients (MCP) the user authorized — list + revoke. */
export function ConnectedAppsBlock() {
	const t = useTranslations();
	const format = useFormatter();
	const [apps, setApps] = useState<ConnectedApp[]>([]);
	const [loading, setLoading] = useState(true);
	const [revoking, setRevoking] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const res = await authClient.$fetch<ConnectedApp[]>(
				"/mcp-oauth/connected-apps",
				{ method: "GET" },
			);
			setApps(res.data ?? []);
		} catch (err) {
			log.error("failed to load connected apps", { err });
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	async function revoke(clientId: string) {
		setRevoking(clientId);
		setFailed(false);
		try {
			const res = await authClient.$fetch("/mcp-oauth/connected-apps/revoke", {
				method: "POST",
				body: { clientId },
			});
			if (res.error) setFailed(true);
			await load();
		} catch (err) {
			log.error("failed to revoke connected app", { err });
			setFailed(true);
		} finally {
			setRevoking(null);
		}
	}

	return (
		<div className="space-y-5" data-testid="connected-apps">
			<div>
				<h3 className="font-semibold text-lg">
					{t("settings.connectedApps.title")}
				</h3>
				<p className="text-muted-foreground text-sm">
					{t("settings.connectedApps.description", {
						appName: config.app.name,
					})}
				</p>
			</div>
			{failed && (
				<p className="text-destructive text-sm" role="alert">
					{t("settings.connectedApps.failed")}
				</p>
			)}
			{loading ? (
				<p className="text-muted-foreground text-sm">{t("common.loading")}</p>
			) : apps.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					{t("settings.connectedApps.none")}
				</p>
			) : (
				<ul className="divide-y rounded-lg border">
					{apps.map((app) => (
						<li
							key={app.clientId}
							className="flex items-center justify-between gap-4 p-4"
							data-testid="connected-app"
						>
							<div className="flex min-w-0 items-center gap-3">
								<div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
									<PlugZap className="size-4 text-muted-foreground" />
								</div>
								<div className="min-w-0 space-y-0.5">
									<div className="flex flex-wrap items-center gap-2 font-medium text-sm">
										<span className="line-clamp-1 break-all">
											{app.name ?? t("settings.connectedApps.unknownApp")}
										</span>
										{app.unverified && (
											<Badge variant="outline" className="gap-1">
												<ShieldAlert className="size-3" />
												{t("settings.connectedApps.unverified")}
											</Badge>
										)}
									</div>
									<p className="text-muted-foreground text-xs">
										{t("settings.connectedApps.connectedOn", {
											date: format.dateTime(new Date(app.grantedAt), {
												dateStyle: "medium",
											}),
										})}
										{app.organizations.length > 0 &&
											` · ${app.organizations.join(", ")}`}
									</p>
									<p className="break-all text-muted-foreground text-xs">
										{t("settings.connectedApps.scopes", {
											scopes: app.scopes.join(" "),
										})}
									</p>
								</div>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() => revoke(app.clientId)}
								disabled={revoking !== null}
							>
								{t("settings.connectedApps.revoke")}
							</Button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
