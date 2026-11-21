"use client";

import { Button, PageHeader } from "@fuutu/ui";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { appHome } from "@/app-home";

export default function HomePage() {
	// Your home content (src/app-home.tsx), else the kit placeholder.
	const AppHome = appHome;
	return AppHome ? <AppHome /> : <KitHome />;
}

function KitHome() {
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
