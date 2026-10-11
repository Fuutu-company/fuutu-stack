import { Skeleton } from "@fuutu/ui";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthResetPassword } from "@/modules/auth/components/auth-reset-password";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("auth");
	return {
		title: t("resetPassword.title"),
	};
}

export default function ResetPasswordPage() {
	return (
		<Suspense fallback={<Skeleton className="h-80 w-full max-w-md" />}>
			<AuthResetPassword />
		</Suspense>
	);
}
