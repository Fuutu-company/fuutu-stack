"use client";

import { Card, CardHeader, CardTitle } from "@fuutu/ui";
import { useTranslations } from "next-intl";

export default function AccountPage() {
	const t = useTranslations("desktop.shell.nav");
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("account")}</CardTitle>
			</CardHeader>
		</Card>
	);
}
