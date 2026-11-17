"use client";

import { authClient } from "@fuutu/auth/client";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
	Button,
	Card,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
} from "@fuutu/ui";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { planGateMessage } from "@/lib/api-error";

export function DeleteAccountBlock() {
	const t = useTranslations();
	const router = useRouter();
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// Passwordless accounts (social, magic link, passkey) confirm with a
	// recent sign-in instead. Unknown until loaded: ask for the password.
	const [hasPassword, setHasPassword] = useState(true);

	useEffect(() => {
		let active = true;
		authClient
			.listAccounts()
			.then((res) => {
				if (!active || !res.data) return;
				setHasPassword(
					res.data.some((account) => account.providerId === "credential"),
				);
			})
			.catch(() => {});
		return () => {
			active = false;
		};
	}, []);

	async function onConfirm() {
		setIsLoading(true);
		setError(null);
		try {
			const res = await authClient.deleteUser(hasPassword ? { password } : {});
			if (res.error) {
				const code = res.error.code;
				setError(
					code === "SOLE_ORGANIZATION_OWNER"
						? t("settings.danger.soleOwner")
						: code === "SESSION_NOT_FRESH"
							? t("settings.danger.reauthRequired")
							: code === "SUBSCRIPTION_CANCELLATION_FAILED"
								? t("settings.danger.subscriptionNotCancelled")
								: planGateMessage(res.error, t, "settings.danger.failed"),
				);
				return;
			}
			router.push("/");
			router.refresh();
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<Card className="gap-5 bg-destructive/5 p-6 ring-destructive/30 md:p-8">
			<div>
				<h3 className="font-bold font-heading text-destructive text-lg tracking-heading">
					{t("settings.danger.title")}
				</h3>
				<p className="text-muted-foreground text-sm">
					{t("settings.danger.description")}
				</p>
			</div>
			{hasPassword ? (
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="delete-password">
							{t("settings.danger.confirmPassword")}
						</FieldLabel>
						<Input
							id="delete-password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
						/>
					</Field>
				</FieldGroup>
			) : (
				<p className="text-muted-foreground text-sm">
					{t("settings.danger.passwordlessHint")}
				</p>
			)}
			{error && (
				<div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
					{error}
				</div>
			)}
			<AlertDialog>
				<AlertDialogTrigger asChild>
					<Button
						variant="destructive"
						disabled={(hasPassword && !password) || isLoading}
					>
						{t("settings.danger.button")}
					</Button>
				</AlertDialogTrigger>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("settings.danger.confirmTitle")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("settings.danger.confirmDescription")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
						<AlertDialogAction onClick={onConfirm} variant="destructive">
							{t("settings.danger.confirmCta")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Card>
	);
}
