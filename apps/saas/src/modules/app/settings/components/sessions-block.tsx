"use client";

import { authClient } from "@fuutu/auth/client";
import { createLogger } from "@fuutu/logs";
import { Badge, Button } from "@fuutu/ui";
import { Monitor, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

const log = createLogger({ scope: "settings-sessions" });

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
	const [failed, setFailed] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const res = await authClient.listSessions();
			const data = (res.data ?? []) as Session[];
			setSessions(
				[...data].sort(
					(a, b) =>
						new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
						a.id.localeCompare(b.id),
				),
			);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	// Better Auth returns errors instead of throwing: a failed revoke must
	// not look like a success (the session would stay signed in).
	async function runRevoke(
		key: string,
		call: () => Promise<{ error: unknown }>,
	): Promise<void> {
		setRevoking(key);
		setFailed(false);
		try {
			const res = await call();
			if (res.error) setFailed(true);
			await load();
		} catch (err) {
			log.error("failed to revoke session", { err });
			setFailed(true);
		} finally {
			setRevoking(null);
		}
	}

	function revoke(token: string) {
		return runRevoke(token, () => authClient.revokeSession({ token }));
	}

	function revokeAllOthers() {
		return runRevoke("__all__", () => authClient.revokeOtherSessions());
	}

	return (
		<div className="space-y-5">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h3 className="font-bold font-heading text-lg tracking-heading">
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
			{failed && (
				<p className="text-destructive text-sm" role="alert">
					{t("settings.sessions.failed")}
				</p>
			)}
			{loading ? (
				<p className="text-muted-foreground text-sm">{t("common.loading")}</p>
			) : sessions.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					{t("settings.sessions.none")}
				</p>
			) : (
				<ul className="divide-y overflow-hidden rounded-xl border">
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
									<div className="flex shrink-0 items-center justify-center">
										<Icon className="size-5 text-muted-foreground" />
									</div>
									<div className="space-y-0.5">
										<div className="flex items-center gap-2 font-medium text-sm">
											<span className="line-clamp-1" data-volatile>
												{ua || "—"}
											</span>
											{isCurrent && (
												<Badge variant="secondary">
													{t("settings.sessions.current")}
												</Badge>
											)}
										</div>
										<p className="text-muted-foreground text-xs" data-volatile>
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
