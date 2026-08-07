"use client";

import { authClient } from "@fuutu/auth/client";
import { Button, Field, FieldGroup, FieldLabel, Input } from "@fuutu/ui";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

export function ProfileForm() {
	const t = useTranslations();
	const { data: session } = authClient.useSession();
	const [name, setName] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [status, setStatus] = useState<string | null>(null);

	useEffect(() => {
		if (session?.user?.name) setName(session.user.name);
	}, [session?.user?.name]);

	async function save(e: React.FormEvent) {
		e.preventDefault();
		setIsSaving(true);
		setStatus(null);
		try {
			const res = await authClient.updateUser({ name });
			setStatus(
				res.error ? t("settings.profile.failed") : t("settings.profile.saved"),
			);
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<form onSubmit={save} className="space-y-6">
			<div>
				<h3 className="font-semibold text-lg">{t("settings.profile.title")}</h3>
				<p className="text-muted-foreground text-sm">
					{t("settings.profile.description")}
				</p>
			</div>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="name">
						{t("settings.profile.fullName")}
					</FieldLabel>
					<Input
						id="name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder={t("settings.profile.fullNamePlaceholder")}
						required
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="email">
						{t("settings.profile.emailLabel")}
					</FieldLabel>
					<Input
						id="email"
						type="email"
						value={session?.user?.email ?? ""}
						disabled
					/>
				</Field>
			</FieldGroup>
			<div className="flex items-center gap-3">
				<Button type="submit" disabled={isSaving || !name.trim()}>
					{isSaving ? t("common.saving") : t("common.save")}
				</Button>
				{status && (
					<span className="text-muted-foreground text-sm">{status}</span>
				)}
			</div>
		</form>
	);
}
