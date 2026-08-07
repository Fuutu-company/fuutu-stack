"use client";

import { authClient } from "@fuutu/auth/client";
import { createLogger } from "@fuutu/logs";
import { Button, Field, FieldGroup, FieldLabel, Input } from "@fuutu/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";

const log = createLogger({ scope: "email-change" });

export function EmailChangeForm() {
	const t = useTranslations("settings");
	const { data: session } = authClient.useSession();
	const [newEmail, setNewEmail] = useState("");
	const [saving, setSaving] = useState(false);
	const [status, setStatus] = useState<string | null>(null);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		setStatus(null);
		try {
			const res = await authClient.changeEmail({
				newEmail,
				callbackURL: "/auth/verify-email-change",
			});
			if (res.error) {
				setStatus(t("emailChange.failed"));
			} else {
				setStatus(t("emailChange.sent"));
				setNewEmail("");
			}
		} catch (e) {
			log.error("email change failed", { err: e });
			setStatus(t("emailChange.failed"));
		} finally {
			setSaving(false);
		}
	}

	return (
		<form onSubmit={submit} className="space-y-5">
			<div>
				<h3 className="font-semibold text-lg">{t("emailChange.title")}</h3>
				<p className="text-muted-foreground text-sm">
					{t("emailChange.description")}
				</p>
			</div>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="current-email">
						{t("profile.emailLabel")}
					</FieldLabel>
					<Input
						id="current-email"
						type="email"
						value={session?.user?.email ?? ""}
						disabled
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="new-email">
						{t("emailChange.newEmail")}
					</FieldLabel>
					<Input
						id="new-email"
						type="email"
						value={newEmail}
						onChange={(e) => setNewEmail(e.target.value)}
						placeholder={t("emailChange.newEmailPlaceholder")}
						required
					/>
				</Field>
			</FieldGroup>
			<div className="flex items-center gap-3">
				<Button type="submit" disabled={saving || !newEmail.trim()}>
					{saving ? t("emailChange.sending") : t("emailChange.submit")}
				</Button>
				{status && (
					<span className="text-muted-foreground text-sm">{status}</span>
				)}
			</div>
		</form>
	);
}
