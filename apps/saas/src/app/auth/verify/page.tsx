"use client";

import { authClient } from "@fuutu/auth/client";
import { AuthCard, Button } from "@fuutu/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

export default function VerifyPage() {
	const t = useTranslations("auth");
	const params = useSearchParams();
	const token = params.get("token");
	const [status, setStatus] = useState<"idle" | "verifying" | "ok" | "error">(
		token ? "verifying" : "idle",
	);
	const [message, setMessage] = useState<string | null>(null);

	useEffect(() => {
		if (!token) return;
		let cancelled = false;
		(async () => {
			try {
				const res = await authClient.verifyEmail({ query: { token } });
				if (cancelled) return;
				if (res.error) {
					setStatus("error");
					setMessage(t("verify.failed"));
				} else {
					setStatus("ok");
				}
			} catch {
				if (!cancelled) {
					setStatus("error");
					setMessage(t("verify.requestFailed"));
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [token, t]);

	return (
		<AuthCard title={t("verify.title")}>
			{status === "idle" && (
				<div className="flex flex-col gap-4 text-center">
					<p className="text-muted-foreground text-sm">{t("verify.idle")}</p>
					<Button asChild variant="outline" className="w-full">
						<Link href="/auth/sign-in">{t("backToSignIn")}</Link>
					</Button>
				</div>
			)}
			{status === "verifying" && (
				<p className="text-center text-muted-foreground text-sm">
					{t("verify.verifying")}
				</p>
			)}
			{status === "ok" && (
				<div className="flex flex-col gap-4 text-center">
					<p className="font-medium">{t("verify.ok")}</p>
					<Button asChild className="w-full">
						<Link href="/dashboard">{t("verify.continue")}</Link>
					</Button>
				</div>
			)}
			{status === "error" && (
				<div className="flex flex-col gap-4 text-center">
					<p className="text-destructive text-sm">{message}</p>
					<Button asChild variant="outline" className="w-full">
						<Link href="/auth/sign-in">{t("backToSignIn")}</Link>
					</Button>
				</div>
			)}
		</AuthCard>
	);
}
