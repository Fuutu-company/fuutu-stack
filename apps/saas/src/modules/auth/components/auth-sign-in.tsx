"use client";

import { authClient } from "@fuutu/auth/client";
import { getSafeRedirect } from "@fuutu/auth/redirect";
import { env } from "@fuutu/env/saas";
import {
	Button,
	Card,
	CardContent,
	cn,
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldSeparator,
	Input,
} from "@fuutu/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

const MARKETING_URL = env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3001";

export function AuthSignIn({
	className,
	...props
}: React.ComponentProps<"div">) {
	const t = useTranslations("auth");
	const tApp = useTranslations("app");
	const router = useRouter();
	const searchParams = useSearchParams();
	// Validate redirect to prevent open-redirect attacks
	const redirectTo = getSafeRedirect(searchParams.get("redirect"));
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setIsLoading(true);
		setError(null);

		const formData = new FormData(e.currentTarget);
		const email = formData.get("email") as string;
		const password = formData.get("password") as string;

		try {
			const result = await authClient.signIn.email({
				email,
				password,
			});

			if (result.error) {
				// Generic message avoids account enumeration (security rule #5)
				setError(t("signInForm.errorInvalid"));
				return;
			}

			// Next 16 typed routes can't narrow a runtime-validated redirect;
			// getSafeRedirect already constrains it to same-origin/internal.
			router.push(redirectTo as never);
			router.refresh();
		} catch {
			setError(t("signInForm.errorUnexpected"));
		} finally {
			setIsLoading(false);
		}
	}

	async function handleSocialSignIn(provider: "google" | "github") {
		setIsLoading(true);
		setError(null);

		try {
			await authClient.signIn.social({
				provider,
				callbackURL: redirectTo,
			});
		} catch {
			setError(t("signInForm.errorSocial"));
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
					{t("signInForm.welcome")}
				</h1>
				<p className="text-muted-foreground text-sm">
					{t("signInForm.subtitle")}
				</p>
			</div>
			<Card className="p-0 shadow-xl">
				<CardContent className="p-6 md:p-8">
					<form onSubmit={handleSubmit}>
						<FieldGroup>
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
							</Field>

							<Field>
								<div className="flex items-center">
									<FieldLabel htmlFor="password">{t("password")}</FieldLabel>
									<Link
										href="/auth/forgot-password"
										className="ml-auto text-sm underline-offset-2 hover:underline"
									>
										{t("signInForm.forgotPassword")}
									</Link>
								</div>
								<Input
									id="password"
									name="password"
									type="password"
									required
									disabled={isLoading}
								/>
							</Field>

							<Field>
								<Button type="submit" disabled={isLoading}>
									{isLoading
										? t("signInForm.signingIn")
										: t("signInForm.button")}
								</Button>
							</Field>

							<FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
								{t("signInForm.orContinueWith")}
							</FieldSeparator>

							<Field className="grid grid-cols-2 gap-4">
								<Button
									variant="outline"
									type="button"
									disabled={isLoading}
									onClick={() => handleSocialSignIn("google")}
								>
									<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
										<title>Google</title>
										<path
											d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
											fill="currentColor"
										/>
									</svg>
									<span className="sr-only">
										{t("signInForm.socialGoogle")}
									</span>
								</Button>
								<Button
									variant="outline"
									type="button"
									disabled={isLoading}
									onClick={() => handleSocialSignIn("github")}
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										viewBox="0 0 24 24"
										fill="currentColor"
									>
										<title>GitHub</title>
										<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
									</svg>
									<span className="sr-only">
										{t("signInForm.socialGithub")}
									</span>
								</Button>
							</Field>

							<FieldDescription className="text-center">
								{t("noAccount")}{" "}
								<Link href="/auth/sign-up">{t("signInForm.signUpLink")}</Link>
							</FieldDescription>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
			<FieldDescription className="px-6 text-center">
				{t("signInForm.termsAgreement")}{" "}
				<Link
					href={`${MARKETING_URL}/legal/terms`}
					target="_blank"
					rel="noopener noreferrer"
				>
					{t("signInForm.terms")}
				</Link>{" "}
				{t("signInForm.and")}{" "}
				<Link
					href={`${MARKETING_URL}/legal/privacy`}
					target="_blank"
					rel="noopener noreferrer"
				>
					{t("signInForm.privacy")}
				</Link>
				.
			</FieldDescription>
		</div>
	);
}
