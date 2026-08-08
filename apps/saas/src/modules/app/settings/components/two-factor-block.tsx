"use client";

import { authClient } from "@fuutu/auth/client";
import { Button, Field, FieldGroup, FieldLabel, Input } from "@fuutu/ui";
import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";

export function TwoFactorBlock() {
	const t = useTranslations("settings.twoFactor");
	const { data: session } = authClient.useSession();
	const enabled = Boolean(
		(session?.user as { twoFactorEnabled?: boolean } | undefined)
			?.twoFactorEnabled,
	);

	const [password, setPassword] = useState("");
	const [qr, setQr] = useState<string | null>(null);
	const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function enable() {
		setIsLoading(true);
		setError(null);
		try {
			const res = await authClient.twoFactor.enable({ password });
			if (res.error) {
				setError(t("failed"));
				return;
			}
			const data = res.data as {
				totpURI?: string;
				backupCodes?: string[];
			} | null;
			setQr(data?.totpURI ?? null);
			setBackupCodes(data?.backupCodes ?? null);
		} finally {
			setIsLoading(false);
		}
	}

	async function disable() {
		setIsLoading(true);
		setError(null);
		try {
			const res = await authClient.twoFactor.disable({ password });
			if (res.error) setError(t("failed"));
			else {
				setQr(null);
				setBackupCodes(null);
			}
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<div className="space-y-5">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h3 className="font-semibold text-lg">{t("title")}</h3>
					<p className="text-muted-foreground text-sm">{t("description")}</p>
				</div>
				<span
					className={`rounded-full border px-2.5 py-0.5 font-medium text-xs ${
						enabled
							? "border-success/30 bg-success/10 text-success"
							: "bg-muted text-muted-foreground"
					}`}
				>
					{enabled ? t("statusEnabled") : t("statusDisabled")}
				</span>
			</div>

			{error && (
				<div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
					{error}
				</div>
			)}

			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="twofa-password">
						{t("currentPassword")}
					</FieldLabel>
					<Input
						id="twofa-password"
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder={t("currentPasswordPlaceholder")}
					/>
				</Field>
			</FieldGroup>

			<div className="flex gap-3">
				{enabled ? (
					<Button
						variant="outline"
						onClick={disable}
						disabled={isLoading || !password}
					>
						{t("disable")}
					</Button>
				) : (
					<Button onClick={enable} disabled={isLoading || !password}>
						<ShieldCheck className="mr-2 size-4" />
						{t("enable")}
					</Button>
				)}
			</div>

			{qr && (
				<div className="space-y-3 rounded-lg border bg-muted/50 p-4 text-sm">
					<div>
						<p className="font-medium">{t("qrTitle")}</p>
						<p className="text-muted-foreground text-xs">
							{t("qrDescription")}
						</p>
					</div>
					<div className="flex justify-center rounded-md bg-background p-4">
						<QRCodeSVG value={qr} size={192} level="M" includeMargin={false} />
					</div>
					<details className="text-xs">
						<summary className="cursor-pointer text-muted-foreground">
							{t("qrManualEntry")}
						</summary>
						<code className="mt-2 block break-all font-mono text-muted-foreground">
							{qr}
						</code>
					</details>
				</div>
			)}

			{backupCodes && backupCodes.length > 0 && (
				<div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
					<p className="mb-1 font-medium text-sm">{t("backupCodes")}</p>
					<p className="mb-2 text-muted-foreground text-xs">
						{t("backupCodesHint")}
					</p>
					<div className="grid grid-cols-2 gap-2 font-mono text-xs">
						{backupCodes.map((c) => (
							<code key={c} className="rounded bg-background px-2 py-1">
								{c}
							</code>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
