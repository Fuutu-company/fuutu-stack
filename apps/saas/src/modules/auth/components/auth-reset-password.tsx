"use client";

import { authClient } from "@fuutu/auth/client";
import { validatePassword } from "@fuutu/auth/validate-password";
import {
	Button,
	Card,
	CardContent,
	cn,
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	Input,
} from "@fuutu/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { usePasswordPolicyTranslator } from "@/lib/password-policy";

export function AuthResetPassword({
	className,
	...props
}: React.ComponentProps<"div">) {
	const t = useTranslations("auth");
	const tApp = useTranslations("app");
	const translatePolicy = usePasswordPolicyTranslator();
	const router = useRouter();
	const searchParams = useSearchParams();
	const token = searchParams.get("token");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (!token) {
			setError(t("resetPassword.missingToken"));
			return;
		}
		setIsLoading(true);
		setError(null);

		const data = new FormData(e.currentTarget);
		const password = data.get("password") as string;
		const confirm = data.get("confirm") as string;

		if (password !== confirm) {
			setError(t("resetPassword.mismatch"));
			setIsLoading(false);
			return;
		}
		const policyError = validatePassword(password);
		if (policyError) {
			setError(translatePolicy(policyError));
			setIsLoading(false);
			return;
		}

		try {
			const res = await authClient.resetPassword({
				newPassword: password,
				token,
			});
			if (res.error) {
				setError(t("resetPassword.failed"));
				return;
			}
			setSuccess(true);
			setTimeout(() => router.push("/auth/sign-in"), 1500);
		} catch {
			setError(t("resetPassword.failed"));
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<div
			className={cn("flex w-full max-w-md flex-col gap-6", className)}
			{...props}
		>
			<div className="flex flex-col items-center gap-3 text-center">
				<Link
					href="/"
					className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"
					aria-label={tApp("brand")}
				>
					<svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden>
						<title>{tApp("brand")}</title>
						<path
							d="M12 2l2.5 5.5L20 10l-5.5 2.5L12 18l-2.5-5.5L4 10l5.5-2.5L12 2z"
							fill="currentColor"
						/>
					</svg>
				</Link>
				<h1 className="font-semibold text-2xl tracking-tight">
					{t("resetPassword.title")}
				</h1>
				<p className="text-muted-foreground text-sm">
					{t("resetPassword.description")}
				</p>
			</div>
			<Card className="shadow-xl">
				<CardContent className="p-6 md:p-8">
					{success ? (
						<div className="space-y-3 text-center">
							<p className="font-medium">{t("resetPassword.success")}</p>
							<p className="text-muted-foreground text-sm">
								{t("resetPassword.redirecting")}
							</p>
						</div>
					) : (
						<form onSubmit={handleSubmit}>
							<FieldGroup>
								{error && (
									<div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
										{error}
									</div>
								)}
								<Field>
									<FieldLabel htmlFor="password">
										{t("resetPassword.newPassword")}
									</FieldLabel>
									<Input
										id="password"
										name="password"
										type="password"
										required
										disabled={isLoading}
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor="confirm">
										{t("resetPassword.confirmPassword")}
									</FieldLabel>
									<Input
										id="confirm"
										name="confirm"
										type="password"
										required
										disabled={isLoading}
									/>
								</Field>
								<Field>
									<Button type="submit" disabled={isLoading || !token}>
										{isLoading
											? t("resetPassword.submitting")
											: t("resetPassword.submit")}
									</Button>
								</Field>
								<FieldDescription className="text-center">
									{t("rememberedIt")}{" "}
									<Link href="/auth/sign-in">{t("signInLink")}</Link>
								</FieldDescription>
							</FieldGroup>
						</form>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
