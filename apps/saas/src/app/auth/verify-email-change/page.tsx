"use client";

import { AuthCard, Button } from "@fuutu/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

export default function VerifyEmailChangePage() {
	const t = useTranslations("auth");
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
		<AuthCard title={t("emailChange.title")}>
			{status === "verifying" && (
				<p className="text-center text-muted-foreground text-sm">
					{t("emailChange.verifying")}
				</p>
			)}
			{status === "ok" && (
				<div className="flex flex-col gap-4 text-center">
					<p className="font-medium">{t("emailChange.success")}</p>
					<Button asChild className="w-full">
						<Link href="/settings">{t("emailChange.continue")}</Link>
					</Button>
				</div>
			)}
			{status === "error" && (
				<div className="flex flex-col gap-4 text-center">
					<p className="text-destructive text-sm">{t("emailChange.error")}</p>
					<Button asChild variant="outline" className="w-full">
						<Link href="/settings">{t("emailChange.continue")}</Link>
					</Button>
				</div>
			)}
		</AuthCard>
	);
}
