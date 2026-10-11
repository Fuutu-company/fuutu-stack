"use client";

import { authClient } from "@fuutu/auth/client";
import { authConfig } from "@fuutu/auth/config";
import { getSafeRedirect } from "@fuutu/auth/redirect";
import { validatePassword } from "@fuutu/auth/validate-password";
import { env } from "@fuutu/env/saas";
import {
	AuthCard,
	Button,
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldSeparator,
	Input,
} from "@fuutu/ui";
import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { usePasswordPolicyTranslator } from "@/lib/password-policy";

const MARKETING_URL = env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3001";

const PASSWORD_POLICY = authConfig.passwordPolicy;

export function AuthSignUp({
	className,
	...props
}: React.ComponentProps<"div">) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const t = useTranslations("auth");
	const translatePolicy = usePasswordPolicyTranslator();
	const requirements = [
		t("passwordPolicy.minLength", { min: PASSWORD_POLICY.minLength }),
		PASSWORD_POLICY.requireUppercase && t("passwordPolicy.uppercase"),
		PASSWORD_POLICY.requireLowercase && t("passwordPolicy.lowercase"),
		PASSWORD_POLICY.requireNumbers && t("passwordPolicy.numbers"),
		PASSWORD_POLICY.requireSpecialChars && t("passwordPolicy.special"),
	]
		.filter(Boolean)
		.join(", ");
	const redirectTo = getSafeRedirect(
		searchParams.get("redirect") ?? authConfig.redirects.afterSignUp,
	);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Read the last used login method from the cookie set by the
	// lastLoginMethod plugin — helps users pick the same provider again.
	// Must be read client-side only (after mount) to avoid hydration
	// mismatches — the cookie doesn't exist during SSR.
	const [lastMethod, setLastMethod] = useState<string | null>(null);
	useEffect(() => {
		setLastMethod(authClient.getLastUsedLoginMethod());
	}, []);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setIsLoading(true);
		setError(null);

		const formData = new FormData(e.currentTarget);
		const email = formData.get("email") as string;
		const password = formData.get("password") as string;
		const confirmPassword = formData.get("confirm-password") as string;
		const name = formData.get("name") as string;

		if (password !== confirmPassword) {
			setError(t("signUpForm.passwordMismatch"));
			setIsLoading(false);
			return;
		}

		const passwordError = validatePassword(password);
		if (passwordError) {
			setError(translatePolicy(passwordError));
			setIsLoading(false);
			return;
		}

		try {
			const result = await authClient.signUp.email({
				email,
				password,
				name,
			});

			if (result.error) {
				setError(t("signUpForm.errorInvalid"));
				return;
			}

			router.push(redirectTo);
			router.refresh();
		} catch {
			setError(t("signUpForm.errorUnexpected"));
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
			setError(t("signUpForm.errorSocial"));
			setIsLoading(false);
		}
	}

	return (
		<AuthCard
			title={t("signUpForm.title")}
			description={t("signUpForm.subtitle")}
			className={className}
			footer={
				<>
					{t("signUpForm.termsAgreement")}{" "}
					<Link
						href={`${MARKETING_URL}/legal/terms`}
						target="_blank"
						rel="noopener noreferrer"
					>
						{t("signUpForm.terms")}
					</Link>{" "}
					{t("signUpForm.and")}{" "}
					<Link
						href={`${MARKETING_URL}/legal/privacy`}
						target="_blank"
						rel="noopener noreferrer"
					>
						{t("signUpForm.privacy")}
					</Link>
					{t("signUpForm.termsPeriod")}
				</>
			}
			{...props}
		>
			<form onSubmit={handleSubmit}>
				<FieldGroup>
					{error && (
						<div className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm">
							{error}
						</div>
					)}

					<Field>
						<FieldLabel htmlFor="name">{t("signUpForm.name")}</FieldLabel>
						<Input
							id="name"
							name="name"
							type="text"
							placeholder={t("signUpForm.namePlaceholder")}
							required
							disabled={isLoading}
						/>
					</Field>

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
						<FieldDescription>{t("signUpForm.emailHint")}</FieldDescription>
					</Field>

					<Field>
						<Field className="grid grid-cols-2 gap-4">
							<Field>
								<FieldLabel htmlFor="password">{t("password")}</FieldLabel>
								<Input
									id="password"
									name="password"
									type="password"
									required
									disabled={isLoading}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="confirm-password">
									{t("signUpForm.confirmPassword")}
								</FieldLabel>
								<Input
									id="confirm-password"
									name="confirm-password"
									type="password"
									required
									disabled={isLoading}
								/>
							</Field>
						</Field>
						<FieldDescription>
							{t("signUpForm.passwordRequirements", {
								requirements,
							})}
						</FieldDescription>
					</Field>

					<Field>
						<Button type="submit" disabled={isLoading} className="w-full">
							{isLoading ? t("signUpForm.signingUp") : t("signUpForm.button")}
						</Button>
					</Field>

					<FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
						{t("signUpForm.orContinueWith")}
					</FieldSeparator>

					<Field className="grid grid-cols-2 gap-4">
						<Button
							variant={lastMethod === "google" ? "default" : "outline"}
							type="button"
							disabled={isLoading}
							onClick={() => handleSocialSignIn("google")}
							className="relative"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								className="size-4"
							>
								<title>Google</title>
								<path
									d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
									fill="#4285F4"
								/>
								<path
									d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
									fill="#34A853"
								/>
								<path
									d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
									fill="#FBBC05"
								/>
								<path
									d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
									fill="#EA4335"
								/>
							</svg>
							<span className="sr-only">{t("signUpForm.socialGoogle")}</span>
							{lastMethod === "google" && (
								<span className="absolute -top-2 -right-2 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
									<Check className="size-3" />
								</span>
							)}
						</Button>
						<Button
							variant={lastMethod === "github" ? "default" : "outline"}
							type="button"
							disabled={isLoading}
							onClick={() => handleSocialSignIn("github")}
							className="relative"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								className="size-4"
							>
								<title>GitHub</title>
								<path
									d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
									fill="currentColor"
								/>
							</svg>
							<span className="sr-only">{t("signUpForm.socialGithub")}</span>
							{lastMethod === "github" && (
								<span className="absolute -top-2 -right-2 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
									<Check className="size-3" />
								</span>
							)}
						</Button>
					</Field>
				</FieldGroup>
			</form>
		</AuthCard>
	);
}
