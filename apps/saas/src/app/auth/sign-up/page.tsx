import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthSignUp } from "@/modules/auth/components/auth-sign-up";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("auth");
	return {
		title: t("signUp"),
	};
}

export default function SignUpPage() {
	return <AuthSignUp />;
}
