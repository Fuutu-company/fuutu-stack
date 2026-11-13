"use client";

import { authClient } from "@fuutu/auth/client";
import { getSafeRedirect } from "@fuutu/auth/redirect";
import {
	getTwoFactorErrorKey,
	type TwoFactorErrorKey,
} from "@fuutu/auth/two-factor";
import {
	AuthCard,
	Button,
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	Input,
} from "@fuutu/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

type Mode = "totp" | "backup";

/**
 * Second step of a credential sign-in for users with 2FA on. Better Auth
 * holds the pending sign-in in a short-lived signed `two_factor` cookie;
 * a valid TOTP or backup code turns it into a real session.
 */
export function AuthTwoFactor() {
	const t = useTranslations("auth");
	const router = useRouter();
	const searchParams = useSearchParams();
	const redirectTo = getSafeRedirect(searchParams.get("redirect"));
	const [mode, setMode] = useState<Mode>("totp");
	const [code, setCode] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [errorKey, setErrorKey] = useState<TwoFactorErrorKey | null>(null);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setIsLoading(true);
		setErrorKey(null);
		try {
			const result =
				mode === "totp"
					? await authClient.twoFactor.verifyTotp({ code })
					: await authClient.twoFactor.verifyBackupCode({ code });
			if (result.error) {
				setErrorKey(getTwoFactorErrorKey(result.error.code));
				return;
			}
			router.push(redirectTo);
			router.refresh();
		} catch {
			setErrorKey("failed");
		} finally {
			setIsLoading(false);
		}
	}

	function switchMode() {
		setMode(mode === "totp" ? "backup" : "totp");
		setCode("");
		setErrorKey(null);
	}

	return (
		<AuthCard
			title={t("twoFactor.title")}
			description={
				mode === "totp"
					? t("twoFactor.totpDescription")
					: t("twoFactor.backupDescription")
			}
		>
			<form onSubmit={handleSubmit}>
				<FieldGroup>
					{errorKey && (
						<div
							role="alert"
							className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm"
						>
							{t(`twoFactor.errors.${errorKey}`)}
						</div>
					)}

					<Field>
						<FieldLabel htmlFor="two-factor-code">
							{mode === "totp"
								? t("twoFactor.codeLabel")
								: t("twoFactor.backupCodeLabel")}
						</FieldLabel>
						{mode === "totp" ? (
							<Input
								key="totp"
								id="two-factor-code"
								name="code"
								inputMode="numeric"
								autoComplete="one-time-code"
								maxLength={6}
								value={code}
								onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
								disabled={isLoading}
								required
							/>
						) : (
							<Input
								key="backup"
								id="two-factor-code"
								name="code"
								autoComplete="off"
								value={code}
								onChange={(e) => setCode(e.target.value.trim())}
								disabled={isLoading}
								required
							/>
						)}
					</Field>

					<Field>
						<Button
							type="submit"
							size="lg"
							disabled={isLoading || code.length === 0}
							className="w-full"
						>
							{isLoading ? t("twoFactor.verifying") : t("twoFactor.verify")}
						</Button>
					</Field>

					<FieldDescription className="text-center">
						<button
							type="button"
							onClick={switchMode}
							className="text-sm underline underline-offset-4 hover:decoration-2"
						>
							{mode === "totp"
								? t("twoFactor.useBackupCode")
								: t("twoFactor.useAuthenticator")}
						</button>
					</FieldDescription>

					<FieldDescription className="text-center">
						<Link href="/auth/sign-in" className="underline underline-offset-4">
							{t("backToSignIn")}
						</Link>
					</FieldDescription>
				</FieldGroup>
			</form>
		</AuthCard>
	);
}
