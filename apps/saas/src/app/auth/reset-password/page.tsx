import { AuthCard, Button, Skeleton } from "@fuutu/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { resetLinkIsUsable } from "@/lib/auth-links";
import { isPasswordResetTokenValid } from "@/lib/auth-server";
import { AuthResetPassword } from "@/modules/auth/components/auth-reset-password";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("auth");
	return {
		title: t("resetPassword.title"),
	};
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function param(value: string | string[] | undefined): string | null {
	return (Array.isArray(value) ? value[0] : value) ?? null;
}

export default async function ResetPasswordPage({
	searchParams,
}: {
	searchParams: SearchParams;
}) {
	const params = await searchParams;
	// Better Auth's link endpoint redirects here with `?token=` or
	// `?error=INVALID_TOKEN`; a hand-made or reused link is checked too.
	const usable = await resetLinkIsUsable(
		{ token: param(params.token), error: param(params.error) },
		isPasswordResetTokenValid,
	);
	if (!usable) {
		const t = await getTranslations("auth.resetPassword");
		return (
			<AuthCard title={t("title")}>
				<div className="flex flex-col gap-4">
					<p className="text-destructive text-sm">{t("invalidLink")}</p>
					<Button asChild className="w-full">
						<Link href="/auth/forgot-password">{t("requestNewLink")}</Link>
					</Button>
				</div>
			</AuthCard>
		);
	}
	return (
		<Suspense fallback={<Skeleton className="h-80 w-full max-w-md" />}>
			<AuthResetPassword />
		</Suspense>
	);
}
