"use client";

import { authClient } from "@fuutu/auth/client";
import { validatePassword } from "@fuutu/auth/validate-password";
import { Button, Field, FieldGroup, FieldLabel, Input } from "@fuutu/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { usePasswordPolicyTranslator } from "@/lib/password-policy";

export function ChangePasswordForm() {
	const t = useTranslations("settings.changePassword");
	const translatePolicy = usePasswordPolicyTranslator();
	const [current, setCurrent] = useState("");
	const [next, setNext] = useState("");
	const [confirm, setConfirm] = useState("");
	const [status, setStatus] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setStatus(null);
		if (next !== confirm) {
			setError(t("mismatch"));
			return;
		}
		const policyError = validatePassword(next);
		if (policyError) {
			setError(translatePolicy(policyError));
			return;
		}
		setIsLoading(true);
		try {
			const res = await authClient.changePassword({
				currentPassword: current,
				newPassword: next,
				revokeOtherSessions: true,
			});
			if (res.error) {
				setError(t("failed"));
				return;
			}
			setStatus(t("success"));
			setCurrent("");
			setNext("");
			setConfirm("");
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<form onSubmit={onSubmit} className="space-y-6">
			<div>
				<h3 className="font-semibold text-lg">{t("title")}</h3>
				<p className="text-muted-foreground text-sm">{t("description")}</p>
			</div>
			{error && (
				<div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
					{error}
				</div>
			)}
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="current">{t("current")}</FieldLabel>
					<Input
						id="current"
						type="password"
						value={current}
						onChange={(e) => setCurrent(e.target.value)}
						required
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="new">{t("new")}</FieldLabel>
					<Input
						id="new"
						type="password"
						value={next}
						onChange={(e) => setNext(e.target.value)}
						required
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="confirm">{t("confirm")}</FieldLabel>
					<Input
						id="confirm"
						type="password"
						value={confirm}
						onChange={(e) => setConfirm(e.target.value)}
						required
					/>
				</Field>
			</FieldGroup>
			<div className="flex items-center gap-3">
				<Button type="submit" disabled={isLoading}>
					{isLoading ? t("submitting") : t("submit")}
				</Button>
				{status && (
					<span className="text-muted-foreground text-sm">{status}</span>
				)}
			</div>
		</form>
	);
}
