"use client";

import { authClient } from "@fuutu/auth/client";
import { getTotpSecret, getTwoFactorErrorKey } from "@fuutu/auth/two-factor";
import { Button, Field, FieldGroup, FieldLabel, Input } from "@fuutu/ui";
import { Check, Copy, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";

type Setup = { totpURI: string; backupCodes: string[] };
type Notice = "enabled" | "disabled" | null;

/**
 * TOTP enrollment. Better Auth's `enable` only stores an UNVERIFIED secret —
 * `twoFactorEnabled` flips to true once `verifyTotp` accepts a code from the
 * authenticator, so the flow is: password → QR / setup key / backup codes →
 * code → enabled.
 */
export function TwoFactorBlock() {
	const t = useTranslations("settings.twoFactor");
	const { data: session } = authClient.useSession();
	const enabled = Boolean(
		(session?.user as { twoFactorEnabled?: boolean } | undefined)
			?.twoFactorEnabled,
	);

	const [password, setPassword] = useState("");
	const [setup, setSetup] = useState<Setup | null>(null);
	const [code, setCode] = useState("");
	const [copied, setCopied] = useState(false);
	const [notice, setNotice] = useState<Notice>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const secret = setup ? getTotpSecret(setup.totpURI) : null;

	async function enable() {
		setIsLoading(true);
		setError(null);
		setNotice(null);
		try {
			const res = await authClient.twoFactor.enable({ password });
			if (res.error || res.data?.method !== "totp") {
				setError(t("failed"));
				return;
			}
			setSetup({
				totpURI: res.data.totpURI,
				backupCodes: res.data.backupCodes,
			});
			setPassword("");
			setCode("");
		} catch {
			setError(t("failed"));
		} finally {
			setIsLoading(false);
		}
	}

	async function verify(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setIsLoading(true);
		setError(null);
		try {
			const res = await authClient.twoFactor.verifyTotp({ code });
			if (res.error) {
				setError(
					getTwoFactorErrorKey(res.error.code) === "invalidCode"
						? t("invalidCode")
						: t("failed"),
				);
				return;
			}
			setSetup(null);
			setCode("");
			setNotice("enabled");
		} catch {
			setError(t("failed"));
		} finally {
			setIsLoading(false);
		}
	}

	async function disable() {
		setIsLoading(true);
		setError(null);
		setNotice(null);
		try {
			const res = await authClient.twoFactor.disable({ password });
			if (res.error) {
				setError(t("failed"));
				return;
			}
			setPassword("");
			setNotice("disabled");
		} catch {
			setError(t("failed"));
		} finally {
			setIsLoading(false);
		}
	}

	function cancelSetup() {
		setSetup(null);
		setCode("");
		setError(null);
	}

	async function copySecret() {
		if (!secret) return;
		try {
			await navigator.clipboard.writeText(secret);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard can be blocked (permissions / insecure origin) — the
			// key stays selectable in the read-only input.
		}
	}

	return (
		<div className="space-y-5">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h3 className="font-bold font-heading text-lg tracking-heading">
						{t("title")}
					</h3>
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
				<div
					role="alert"
					className="rounded-md bg-destructive/10 p-3 text-destructive text-sm"
				>
					{error}
				</div>
			)}

			{notice && (
				<div
					role="status"
					className="rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success"
				>
					{notice === "enabled" ? t("enabledNotice") : t("disabledNotice")}
				</div>
			)}

			{setup ? (
				<div className="space-y-5">
					<div className="space-y-3 rounded-lg border bg-muted/50 p-4 text-sm">
						<div>
							<p className="font-medium">{t("qrTitle")}</p>
							<p className="text-muted-foreground text-xs">
								{t("qrDescription")}
							</p>
						</div>
						<div className="flex justify-center rounded-md bg-background p-4">
							<QRCodeSVG
								value={setup.totpURI}
								size={192}
								level="M"
								includeMargin={false}
							/>
						</div>
						{secret && (
							<Field>
								<FieldLabel htmlFor="twofa-secret">
									{t("secretLabel")}
								</FieldLabel>
								<p className="text-muted-foreground text-xs">
									{t("qrManualEntry")}
								</p>
								<div className="flex gap-2">
									<Input
										id="twofa-secret"
										readOnly
										value={secret}
										className="font-mono text-xs"
										onFocus={(e) => e.currentTarget.select()}
									/>
									<Button
										type="button"
										variant="outline"
										onClick={copySecret}
										aria-label={copied ? t("copied") : t("copy")}
									>
										{copied ? (
											<Check className="size-4" />
										) : (
											<Copy className="size-4" />
										)}
									</Button>
								</div>
							</Field>
						)}
					</div>

					{setup.backupCodes.length > 0 && (
						<div className="rounded-lg border border-warning/50 bg-warning/10 p-4">
							<p className="mb-1 font-medium text-sm">{t("backupCodes")}</p>
							<p className="mb-2 text-muted-foreground text-xs">
								{t("backupCodesHint")}
							</p>
							<ul
								aria-label={t("backupCodes")}
								className="grid grid-cols-2 gap-2 font-mono text-xs"
							>
								{setup.backupCodes.map((c) => (
									<li key={c}>
										<code className="block rounded bg-background px-2 py-1">
											{c}
										</code>
									</li>
								))}
							</ul>
						</div>
					)}

					<form onSubmit={verify} className="space-y-3">
						<div>
							<p className="font-medium text-sm">{t("verifyTitle")}</p>
							<p className="text-muted-foreground text-xs">
								{t("verifyDescription")}
							</p>
						</div>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="twofa-code">{t("codeLabel")}</FieldLabel>
								<Input
									id="twofa-code"
									name="code"
									inputMode="numeric"
									autoComplete="one-time-code"
									maxLength={6}
									value={code}
									onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
									disabled={isLoading}
									required
								/>
							</Field>
						</FieldGroup>
						<div className="flex gap-3">
							<Button type="submit" disabled={isLoading || code.length !== 6}>
								{isLoading ? t("verifying") : t("verify")}
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={cancelSetup}
								disabled={isLoading}
							>
								{t("cancel")}
							</Button>
						</div>
					</form>
				</div>
			) : (
				<>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="twofa-password">
								{t("currentPassword")}
							</FieldLabel>
							<Input
								id="twofa-password"
								type="password"
								autoComplete="current-password"
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
				</>
			)}
		</div>
	);
}
