"use client";

import { authClient } from "@fuutu/auth/client";
import {
	Button,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
	Skeleton,
} from "@fuutu/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function ProfileForm() {
	const { data: session, isPending } = authClient.useSession();
	// Mount the form only with the loaded user: starting from an empty name
	// rendered the save button disabled, then faded it in — a visible flicker
	// (and a mid-transition contrast failure in a11y scans).
	if (isPending) return <Skeleton className="h-64 w-full" />;
	return (
		<ProfileFields
			initialName={session?.user?.name ?? ""}
			email={session?.user?.email ?? ""}
		/>
	);
}

function ProfileFields({
	initialName,
	email,
}: {
	initialName: string;
	email: string;
}) {
	const t = useTranslations();
	const [name, setName] = useState(initialName);
	const [isSaving, setIsSaving] = useState(false);
	const [status, setStatus] = useState<string | null>(null);

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
					<Input id="email" type="email" value={email} disabled />
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
