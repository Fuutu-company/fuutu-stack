"use client";

import { Button, Card, CardContent } from "@fuutu/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

export default function VerifyEmailChangePage() {
	const t = useTranslations("auth");
	const tApp = useTranslations("app");
	const params = useSearchParams();
	const error = params.get("error");
	const [status, setStatus] = useState<"verifying" | "ok" | "error">(
		error ? "error" : "verifying",
	);

	useEffect(() => {
		if (error) {
			setStatus("error");
			return;
		}
		// Better Auth processes the token server-side via GET /verify-email
		// before redirecting to this callbackURL. On success it redirects
		// without an error query param; on failure it appends ?error=<code>.
		// The token is consumed server-side and never reaches this page.
		// Landing here without an error param means verification succeeded.
		const timer = setTimeout(() => setStatus("ok"), 300);
		return () => clearTimeout(timer);
	}, [error]);

	return (
		<main className="container flex min-h-screen flex-col items-center justify-center p-4 md:p-6">
			<div className="flex w-full max-w-md flex-col gap-6">
				<div className="flex flex-col items-center gap-3 text-center">
					<Link
						href="/"
						className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"
						aria-label={tApp("brand")}
					>
						<svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden>
							<title>{tApp("brand")}</title>
							<path
								d="M12 2l2.5 5.5L20 10l-5.5 2.5L12 18l-2.5-5.5L4 10l5.5-2.5L12 2z"
								fill="currentColor"
							/>
						</svg>
					</Link>
					<h1 className="font-semibold text-2xl tracking-tight">
						{t("emailChange.title")}
					</h1>
				</div>
				<Card className="shadow-xl">
					<CardContent className="space-y-4 p-6 text-center md:p-8">
						{status === "verifying" && (
							<p className="text-muted-foreground text-sm">
								{t("emailChange.verifying")}
							</p>
						)}
						{status === "ok" && (
							<>
								<p className="font-medium">{t("emailChange.success")}</p>
								<Button asChild className="w-full">
									<Link href="/settings">{t("emailChange.continue")}</Link>
								</Button>
							</>
						)}
						{status === "error" && (
							<>
								<p className="text-destructive text-sm">
									{t("emailChange.error")}
								</p>
								<Button asChild variant="outline" className="w-full">
									<Link href="/settings">{t("emailChange.continue")}</Link>
								</Button>
							</>
						)}
					</CardContent>
				</Card>
			</div>
		</main>
	);
}
