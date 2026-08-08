"use client";

import { authClient } from "@fuutu/auth/client";
import { Badge, Button } from "@fuutu/ui";
import { Monitor, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

type Session = {
	id: string;
	userAgent?: string | null;
	ipAddress?: string | null;
	createdAt: string | Date;
	expiresAt: string | Date;
	token?: string;
};

export function SessionsBlock() {
	const t = useTranslations();
	const { data: currentSession } = authClient.useSession();
	const currentToken = (
		currentSession?.session as { token?: string } | undefined
	)?.token;
	const [sessions, setSessions] = useState<Session[]>([]);
	const [loading, setLoading] = useState(true);
	const [revoking, setRevoking] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const res = await authClient.listSessions();
			const data = (res.data ?? []) as Session[];
			setSessions(data);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	async function revoke(token: string) {
		setRevoking(token);
		try {
			await authClient.revokeSession({ token });
			await load();
		} finally {
			setRevoking(null);
		}
	}

	async function revokeAllOthers() {
		setRevoking("__all__");
		try {
			await authClient.revokeOtherSessions();
			await load();
		} finally {
			setRevoking(null);
		}
	}

	return (
		<div className="space-y-5">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h3 className="font-semibold text-lg">
						{t("settings.sessions.title")}
					</h3>
					<p className="text-muted-foreground text-sm">
						{t("settings.sessions.description")}
					</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={revokeAllOthers}
					disabled={revoking !== null || sessions.length <= 1}
				>
					{t("settings.sessions.revokeAll")}
				</Button>
			</div>
			{loading ? (
				<p className="text-muted-foreground text-sm">{t("common.loading")}</p>
			) : sessions.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					{t("settings.sessions.none")}
				</p>
			) : (
				<ul className="divide-y rounded-lg border">
					{sessions.map((s) => {
						const ua = s.userAgent ?? "";
						const isMobile = /iPhone|Android|Mobile/i.test(ua);
						const Icon = isMobile ? Smartphone : Monitor;
						const isCurrent = Boolean(currentToken && s.token === currentToken);
						return (
							<li
								key={s.id}
								className="flex items-center justify-between gap-4 p-4"
							>
								<div className="flex items-center gap-3">
									<div className="flex size-9 items-center justify-center rounded-md bg-muted">
										<Icon className="size-4 text-muted-foreground" />
									</div>
									<div className="space-y-0.5">
										<p className="flex items-center gap-2 font-medium text-sm">
											<span className="line-clamp-1">{ua || "—"}</span>
											{isCurrent && (
												<Badge variant="secondary">
													{t("settings.sessions.current")}
												</Badge>
											)}
										</p>
										<p className="text-muted-foreground text-xs">
											{s.ipAddress ?? "—"} ·{" "}
											{new Date(s.createdAt).toLocaleDateString()}
										</p>
									</div>
								</div>
								{s.token && !isCurrent && (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => s.token && revoke(s.token)}
										disabled={revoking === s.token}
									>
										{t("settings.sessions.revoke")}
									</Button>
								)}
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
