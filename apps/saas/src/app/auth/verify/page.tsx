"use client";

import { authClient } from "@fuutu/auth/client";
import { Button, Card, CardContent } from "@fuutu/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

export default function VerifyPage() {
	const t = useTranslations();
	const tApp = useTranslations("app");
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
					setMessage(t("auth.verify.failed"));
				} else {
					setStatus("ok");
				}
			} catch {
				if (!cancelled) {
					setStatus("error");
					setMessage(t("auth.verify.requestFailed"));
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [token, t]);

	return (
		<main className="container flex min-h-screen flex-col items-center justify-center p-4 md:p-6">
			<div className="flex w-full max-w-md flex-col gap-6">
				<div className="flex flex-col items-center gap-3 text-center">
					<Link
						href="/"
						className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"
						aria-label={tApp("brand")}
					>
						{/* brand mark */}
						<svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden>
							<title>{tApp("brand")}</title>
							<path
								d="M12 2l2.5 5.5L20 10l-5.5 2.5L12 18l-2.5-5.5L4 10l5.5-2.5L12 2z"
								fill="currentColor"
							/>
						</svg>
					</Link>
					<h1 className="font-semibold text-2xl tracking-tight">
						{t("auth.verify.title")}
					</h1>
				</div>
				<Card className="shadow-xl">
					<CardContent className="space-y-4 p-6 text-center md:p-8">
						{status === "idle" && (
							<>
								<p className="text-muted-foreground text-sm">
									{t("auth.verify.idle")}
								</p>
								<Button asChild variant="outline" className="w-full">
									<Link href="/auth/sign-in">{t("auth.backToSignIn")}</Link>
								</Button>
							</>
						)}
						{status === "verifying" && (
							<p className="text-muted-foreground text-sm">
								{t("auth.verify.verifying")}
							</p>
						)}
						{status === "ok" && (
							<>
								<p className="font-medium">{t("auth.verify.ok")}</p>
								<Button asChild className="w-full">
									<Link href="/dashboard">{t("auth.verify.continue")}</Link>
								</Button>
							</>
						)}
						{status === "error" && (
							<>
								<p className="text-destructive text-sm">{message}</p>
								<Button asChild variant="outline" className="w-full">
									<Link href="/auth/sign-in">{t("auth.backToSignIn")}</Link>
								</Button>
							</>
						)}
					</CardContent>
				</Card>
			</div>
		</main>
	);
}
