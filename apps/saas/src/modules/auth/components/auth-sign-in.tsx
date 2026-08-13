"use client";

import { authClient } from "@fuutu/auth/client";
import { getSafeRedirect } from "@fuutu/auth/redirect";
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
import { Check, Fingerprint, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

const MARKETING_URL = env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3001";

export function AuthSignIn({
	className,
	...props
}: React.ComponentProps<"div">) {
	const t = useTranslations("auth");
	const router = useRouter();
	const searchParams = useSearchParams();
	const redirectTo = getSafeRedirect(searchParams.get("redirect"));
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isMagicLinkMode, setIsMagicLinkMode] = useState(false);
	const [magicLinkSent, setMagicLinkSent] = useState(false);

	// Read the last used login method from the cookie set by the
	// lastLoginMethod plugin. Returns "google" | "github" | "email" |
	// "passkey" | "magic-link" | null.
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

		try {
			const result = await authClient.signIn.email({
				email,
				password,
			});

			if (result.error) {
				setError(t("signInForm.errorInvalid"));
				return;
			}

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

	async function handleMagicLinkSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setIsLoading(true);
		setError(null);

		const formData = new FormData(e.currentTarget);
		const email = formData.get("email") as string;

		try {
			await authClient.signIn.magicLink({
				email,
				callbackURL: redirectTo,
			});
			setMagicLinkSent(true);
		} catch {
			setError(t("signInForm.magicLinkError"));
		} finally {
			setIsLoading(false);
		}
	}

	async function handlePasskeySignIn() {
		setIsLoading(true);
		setError(null);

		try {
			const result = await authClient.signIn.passkey();
			if (result.error) {
				setError(t("signInForm.passkeyError"));
				setIsLoading(false);
			}
		} catch {
			setError(t("signInForm.passkeyError"));
			setIsLoading(false);
		}
	}

	return (
		<AuthCard
			title={t("signInForm.welcome")}
			description={t("signInForm.subtitle")}
			className={className}
			footer={
				<>
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
				</>
			}
			{...props}
		>
			{magicLinkSent ? (
				<div className="flex flex-col gap-4 text-center">
					<p className="font-medium">{t("signInForm.magicLinkSuccess")}</p>
					<Button
						variant="outline"
						onClick={() => setMagicLinkSent(false)}
						className="w-full"
					>
						{t("signInForm.usePassword")}
					</Button>
				</div>
			) : isMagicLinkMode ? (
				<form onSubmit={handleMagicLinkSubmit}>
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
						</Field>

						<Field>
							<Button type="submit" disabled={isLoading} className="w-full">
								{isLoading
									? t("signInForm.sendingMagicLink")
									: t("signInForm.magicLinkButton")}
							</Button>
						</Field>

						<FieldDescription className="text-center">
							<button
								type="button"
								onClick={() => setIsMagicLinkMode(false)}
								className="text-sm underline-offset-2 hover:underline"
							>
								{t("signInForm.usePassword")}
							</button>
						</FieldDescription>
					</FieldGroup>
				</form>
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
							<Button
								type="submit"
								disabled={isLoading}
								className="relative w-full"
							>
								{isLoading ? t("signInForm.signingIn") : t("signInForm.button")}
								{lastMethod === "email" && (
									<span className="absolute right-3 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 font-medium text-[11px] text-white shadow-sm ring-2 ring-amber-300/50">
										<Check className="size-3" strokeWidth={3} />
										{t("signInForm.lastUsed")}
									</span>
								)}
							</Button>
						</Field>

						<Field>
							<Button
								type="button"
								variant="outline"
								onClick={() => setIsMagicLinkMode(true)}
								disabled={isLoading}
								className="relative w-full"
							>
								<Mail className="size-4" />
								{t("signInForm.useMagicLink")}
								{lastMethod === "magic-link" && (
									<span className="absolute right-3 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 font-medium text-[11px] text-white shadow-sm ring-2 ring-amber-300/50">
										<Check className="size-3" strokeWidth={3} />
										{t("signInForm.lastUsed")}
									</span>
								)}
							</Button>
						</Field>

						<FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
							{t("signInForm.orContinueWith")}
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
								<span className="sr-only">{t("signInForm.socialGoogle")}</span>
								{lastMethod === "google" && (
									<span className="absolute -top-2 -right-1 inline-flex items-center gap-0.5 rounded-full bg-amber-500 px-1.5 py-0.5 font-medium text-[10px] text-white shadow-md ring-2 ring-amber-300/50">
										<Check className="size-2.5" strokeWidth={3} />
										{t("signInForm.lastUsed")}
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
									fill="currentColor"
								>
									<title>GitHub</title>
									<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
								</svg>
								<span className="sr-only">{t("signInForm.socialGithub")}</span>
								{lastMethod === "github" && (
									<span className="absolute -top-2 -right-1 inline-flex items-center gap-0.5 rounded-full bg-amber-500 px-1.5 py-0.5 font-medium text-[10px] text-white shadow-md ring-2 ring-amber-300/50">
										<Check className="size-2.5" strokeWidth={3} />
										{t("signInForm.lastUsed")}
									</span>
								)}
							</Button>
						</Field>

						<Field>
							<Button
								variant={lastMethod === "passkey" ? "default" : "outline"}
								type="button"
								disabled={isLoading}
								onClick={handlePasskeySignIn}
								className="relative w-full"
							>
								<Fingerprint className="size-4" />
								{isLoading
									? t("signInForm.passkeySigningIn")
									: t("signInForm.passkeyButton")}
								{lastMethod === "passkey" && (
									<span className="absolute right-3 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 font-medium text-[11px] text-white shadow-sm ring-2 ring-amber-300/50">
										<Check className="size-3" strokeWidth={3} />
										{t("signInForm.lastUsed")}
									</span>
								)}
							</Button>
						</Field>

						<FieldDescription className="text-center">
							{t("noAccount")}{" "}
							<Link
								href="/auth/sign-up"
								className="underline underline-offset-4"
							>
								{t("signInForm.signUpLink")}
							</Link>
						</FieldDescription>
					</FieldGroup>
				</form>
			)}
		</AuthCard>
	);
}
