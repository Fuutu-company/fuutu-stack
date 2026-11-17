"use client";

import { authClient } from "@fuutu/auth/client";
import { getEmailVerificationRedirect } from "@fuutu/auth/redirect";
import { AuthCard, Button, Skeleton } from "@fuutu/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useState } from "react";
import {
	emailVerificationFailure,
	emailVerificationSignInHref,
} from "@/lib/auth-links";
import { useStripQueryParam } from "@/lib/strip-query-param";

export default function VerifyPage() {
	return (
		<Suspense fallback={<Skeleton className="h-80 w-full max-w-md" />}>
			<VerifyContent />
		</Suspense>
	);
}

function VerifyContent() {
	const t = useTranslations("auth");
	const router = useRouter();
	const params = useSearchParams();
	const [token] = useState(() => params.get("token"));
	// Landing page of the mailed link, kept across the sign-in round trip.
	const [callbackURL] = useState(() => params.get("callbackURL"));
	useStripQueryParam("token", token);
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
					const failure = emailVerificationFailure(res.error.code);
					if (failure === "sign-in") {
						router.replace(emailVerificationSignInHref(token, callbackURL));
						return;
					}
					setStatus("error");
					setMessage(
						t(
							failure === "other-account"
								? "verify.otherAccount"
								: "verify.failed",
						),
					);
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
	}, [token, callbackURL, router, t]);

	return (
		<AuthCard title={t("verify.title")}>
			{status === "idle" && (
				<div className="flex flex-col gap-4">
					<p className="text-muted-foreground text-sm">{t("verify.idle")}</p>
					<Button asChild variant="outline" className="w-full">
						<Link href="/auth/sign-in">{t("backToSignIn")}</Link>
					</Button>
				</div>
			)}
			{status === "verifying" && (
				<p className="text-muted-foreground text-sm">{t("verify.verifying")}</p>
			)}
			{status === "ok" && (
				<div className="flex flex-col gap-4">
					<p className="font-medium">{t("verify.ok")}</p>
					<Button asChild className="w-full">
						<Link href={getEmailVerificationRedirect(callbackURL)}>
							{t("verify.continue")}
						</Link>
					</Button>
				</div>
			)}
			{status === "error" && (
				<div className="flex flex-col gap-4">
					<p className="text-destructive text-sm">{message}</p>
					<Button asChild variant="outline" className="w-full">
						<Link href="/auth/sign-in">{t("backToSignIn")}</Link>
					</Button>
				</div>
			)}
		</AuthCard>
	);
}
