import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthResetPassword } from "@/modules/auth/components/auth-reset-password";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("auth");
	return {
		title: t("resetPassword.title"),
	};
}

export default function ResetPasswordPage() {
	return <AuthResetPassword />;
}
