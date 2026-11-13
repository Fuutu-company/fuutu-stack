import { authConfig } from "@fuutu/auth/config";
import { Skeleton } from "@fuutu/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthTwoFactor } from "@/modules/auth/components/auth-two-factor";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("auth");
	return {
		title: t("twoFactor.pageTitle"),
	};
}

export default function TwoFactorPage() {
	if (!authConfig.features.twoFactor) notFound();

	return (
		<Suspense fallback={<Skeleton className="h-80 w-full max-w-md" />}>
			<AuthTwoFactor />
		</Suspense>
	);
}
