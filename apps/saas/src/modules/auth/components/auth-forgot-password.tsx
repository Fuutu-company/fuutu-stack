"use client";

import { authClient } from "@fuutu/auth/client";
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
import { useTranslations } from "next-intl";
import { useState } from "react";

export function AuthForgotPassword({
	className,
	...props
}: React.ComponentProps<"div">) {
	const t = useTranslations("auth");
	const [isLoading, setIsLoading] = useState(false);
	const [submitted, setSubmitted] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setIsLoading(true);
		setError(null);

		const formData = new FormData(e.currentTarget);
		const email = formData.get("email") as string;

		try {
			await authClient.requestPasswordReset({
				email,
				redirectTo: `${window.location.origin}/auth/reset-password`,
			});
			setSubmitted(true);
		} catch {
			setError(t("forgotPasswordForm.error"));
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<AuthCard
			title={t("forgotPasswordForm.title")}
			description={t("forgotPasswordForm.subtitle")}
			className={className}
			{...props}
		>
			{submitted ? (
				<div className="flex flex-col gap-4 text-center">
					<p className="font-medium">{t("forgotPasswordForm.success")}</p>
					<Button asChild variant="outline" className="w-full">
						<Link href="/auth/sign-in">{t("backToSignInArrow")}</Link>
					</Button>
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
							<FieldLabel htmlFor="email">{t("email")}</FieldLabel>
							<Input
								id="email"
								name="email"
								type="email"
								placeholder={t("emailPlaceholder")}
								required
								disabled={isLoading}
							/>
							<FieldDescription>
								{t("forgotPasswordForm.fieldHint")}
							</FieldDescription>
						</Field>

						<Field>
							<Button type="submit" disabled={isLoading} className="w-full">
								{isLoading
									? t("forgotPasswordForm.sending")
									: t("forgotPasswordForm.button")}
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
