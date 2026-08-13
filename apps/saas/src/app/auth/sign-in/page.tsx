import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthSignIn } from "@/modules/auth/components/auth-sign-in";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("auth");
	return {
		title: t("signIn"),
	};
}

export default function SignInPage() {
	return <AuthSignIn />;
}
