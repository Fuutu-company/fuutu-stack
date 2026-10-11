import { Skeleton } from "@fuutu/ui";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthSignIn } from "@/modules/auth/components/auth-sign-in";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("auth");
	return {
		title: t("signIn"),
	};
}

export default function SignInPage() {
	return (
		<Suspense fallback={<Skeleton className="h-80 w-full max-w-md" />}>
			<AuthSignIn />
		</Suspense>
	);
}
