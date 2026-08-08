import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthForgotPassword } from "@/modules/auth/components/auth-forgot-password";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("auth");
	return {
		title: t("forgotPassword"),
	};
}

export default function ForgotPasswordPage() {
	return (
		<main className="container flex min-h-screen flex-col items-center justify-center p-4">
			<div className="mx-auto w-full max-w-md">
				<AuthForgotPassword />
			</div>
		</main>
	);
}
