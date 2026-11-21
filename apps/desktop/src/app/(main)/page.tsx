"use client";

import { Button, PageHeader } from "@fuutu/ui";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function HomePage() {
	const t = useTranslations("desktop.shell.home");
	return (
		<>
			<PageHeader title={t("title")} description={t("description")} />
			<div>
				<Button asChild>
					<Link href="/settings/">{t("openSettings")}</Link>
				</Button>
			</div>
		</>
	);
}
