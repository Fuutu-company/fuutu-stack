import { getAuthMethods } from "@fuutu/auth/methods";
import { Skeleton } from "@fuutu/ui";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { redirectIfSignedIn } from "@/lib/auth-server";
import { AuthSignUp } from "@/modules/auth/components/auth-sign-up";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("auth");
	return {
		title: t("signUp"),
	};
}

export default async function SignUpPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	await redirectIfSignedIn(await searchParams);
	return (
		<Suspense fallback={<Skeleton className="h-80 w-full max-w-md" />}>
			<AuthSignUp methods={getAuthMethods()} />
		</Suspense>
	);
}
