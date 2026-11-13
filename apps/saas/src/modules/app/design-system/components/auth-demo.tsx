"use client";

import {
	AuthCard,
	Button,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
} from "@fuutu/ui";
import Link from "next/link";
import { useTranslations } from "next-intl";

/** Sign-in card as the auth screens render it. The form never submits. */
export function AuthDemo() {
	const t = useTranslations("designSystem.patterns.auth.card");

	return (
		<AuthCard
			title={t("title")}
			description={t("description")}
			footer={t("footer")}
			titleAs="h4"
		>
			<form
				onSubmit={(event) => event.preventDefault()}
				className="mx-auto max-w-sm"
			>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="design-auth-email">{t("email")}</FieldLabel>
						<Input
							id="design-auth-email"
							type="email"
							autoComplete="off"
							placeholder={t("emailPlaceholder")}
						/>
					</Field>
					<Field>
						<div className="flex items-center justify-between gap-2">
							<FieldLabel htmlFor="design-auth-password">
								{t("password")}
							</FieldLabel>
							<Link
								href="/auth/forgot-password"
								className="text-muted-foreground text-sm underline underline-offset-4 hover:text-foreground"
							>
								{t("forgot")}
							</Link>
						</div>
						<Input
							id="design-auth-password"
							type="password"
							autoComplete="off"
						/>
					</Field>
					<Button type="submit" className="w-full">
						{t("submit")}
					</Button>
				</FieldGroup>
			</form>
		</AuthCard>
	);
}
