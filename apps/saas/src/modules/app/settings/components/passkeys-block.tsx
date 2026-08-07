"use client";

import { authClient } from "@fuutu/auth/client";
import { Button } from "@fuutu/ui";
import { KeyRound, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

type Passkey = {
	id: string;
	name?: string | null;
	deviceType?: string | null;
	createdAt: string | Date;
};

export function PasskeysBlock() {
	const t = useTranslations();
	const [keys, setKeys] = useState<Passkey[]>([]);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const res = await authClient.passkey.listUserPasskeys();
			setKeys((res.data ?? []) as Passkey[]);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	async function add() {
		setBusy("__add__");
		setError(null);
		try {
			const res = await authClient.passkey.addPasskey();
			if (res?.error) setError(t("settings.passkeys.failed"));
			await load();
		} catch {
			setError(t("settings.passkeys.failed"));
		} finally {
			setBusy(null);
		}
	}

	async function remove(id: string) {
		setBusy(id);
		try {
			await authClient.passkey.deletePasskey({ id });
			await load();
		} finally {
			setBusy(null);
		}
	}

	return (
		<div className="space-y-5">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h3 className="font-semibold text-lg">
						{t("settings.passkeys.title")}
					</h3>
					<p className="text-muted-foreground text-sm">
						{t("settings.passkeys.description")}
					</p>
				</div>
				<Button size="sm" onClick={add} disabled={busy === "__add__"}>
					<KeyRound className="mr-2 size-4" />
					{busy === "__add__"
						? t("settings.passkeys.adding")
						: t("settings.passkeys.add")}
				</Button>
			</div>
			{error && (
				<div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
					{error}
				</div>
			)}
			{loading ? (
				<p className="text-muted-foreground text-sm">{t("common.loading")}</p>
			) : keys.length === 0 ? (
				<p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
					{t("settings.passkeys.none")}
				</p>
			) : (
				<ul className="divide-y rounded-lg border">
					{keys.map((k) => (
						<li
							key={k.id}
							className="flex items-center justify-between gap-4 p-4"
						>
							<div className="flex items-center gap-3">
								<div className="flex size-9 items-center justify-center rounded-md bg-muted">
									<KeyRound className="size-4 text-muted-foreground" />
								</div>
								<div>
									<p className="font-medium text-sm">
										{k.name ??
											k.deviceType ??
											t("settings.passkeys.defaultName")}
									</p>
									<p className="text-muted-foreground text-xs">
										{t("settings.passkeys.addedOn", {
											date: new Date(k.createdAt).toLocaleDateString(),
										})}
									</p>
								</div>
							</div>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => remove(k.id)}
								disabled={busy === k.id}
							>
								<Trash2 className="size-4" />
								<span className="sr-only">
									{t("settings.passkeys.removeSr")}
								</span>
							</Button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
