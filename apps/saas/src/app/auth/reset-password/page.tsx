import { AuthResetPassword } from "@/modules/auth/components/auth-reset-password";

export default function ResetPasswordPage() {
	return (
		<main className="container flex min-h-screen flex-col items-center justify-center p-4 md:p-6">
			<AuthResetPassword />
		</main>
	);
}
