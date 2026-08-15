"use client";

import { authClient } from "@fuutu/auth/client";
import { validatePassword } from "@fuutu/auth/validate-password";
import {
	AuthCard,
	Button,
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
		<AuthCard
			title={t("resetPassword.title")}
			description={t("resetPassword.description")}
			className={className}
			{...props}
		>
			{success ? (
				<div className="flex flex-col gap-3 text-center">
					<p className="font-medium">{t("resetPassword.success")}</p>
					<p className="text-muted-foreground text-sm">
						{t("resetPassword.redirecting")}
					</p>
				</div>
			) : (
				<form onSubmit={handleSubmit}>
					<FieldGroup>
						{error && (
							<div className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm">
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
							<Button
								type="submit"
								disabled={isLoading || !token}
								className="w-full"
							>
								{isLoading
									? t("resetPassword.submitting")
									: t("resetPassword.submit")}
							</Button>
						</Field>
						<FieldDescription className="text-center">
							{t("rememberedIt")}{" "}
							<Link
								href="/auth/sign-in"
								className="underline underline-offset-4"
							>
								{t("signInLink")}
							</Link>
						</FieldDescription>
					</FieldGroup>
				</form>
			)}
		</AuthCard>
	);
}
