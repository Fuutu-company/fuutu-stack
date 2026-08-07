"use client";

import { authClient } from "@fuutu/auth/client";
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
import { useTranslations } from "next-intl";
import { useState } from "react";

/**
 * Forgot-password form.
 *
 * Calls Better Auth's `forgetPassword`, which invokes the server-side
 * `sendResetPassword` hook in `@fuutu/auth` to dispatch the email.
 *
 * Security: we always show the same success state regardless of whether
 * the email exists, to prevent account enumeration (OWASP A07).
 */
export function AuthForgotPassword({
	className,
	...props
}: React.ComponentProps<"div">) {
	const t = useTranslations("auth");
	const tApp = useTranslations("app");
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
				redirectTo: "/auth/reset-password",
			});
			// Do not reveal whether the email exists
			setSubmitted(true);
		} catch {
			setError(t("forgotPasswordForm.errorUnexpected"));
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
			</div>
			<Card className="shadow-xl">
				<CardContent className="p-6 md:p-8">
					{submitted ? (
						<div className="space-y-4 text-center">
							<h1 className="font-bold text-2xl">
								{t("forgotPasswordForm.success")}
							</h1>
							<Link
								href="/auth/sign-in"
								className="inline-block text-primary text-sm underline-offset-4 hover:underline"
							>
								{t("backToSignInArrow")}
							</Link>
						</div>
					) : (
						<form onSubmit={handleSubmit}>
							<FieldGroup>
								<div className="flex flex-col items-center gap-2 text-center">
									<h1 className="font-bold text-2xl">
										{t("forgotPasswordForm.title")}
									</h1>
									<p className="text-balance text-muted-foreground text-sm">
										{t("forgotPasswordForm.subtitle")}
									</p>
								</div>

								{error && (
									<div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
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
									<Button type="submit" disabled={isLoading}>
										{isLoading
											? t("forgotPasswordForm.sending")
											: t("forgotPasswordForm.button")}
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
