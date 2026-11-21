"use client";

import { Button, Card, CardContent, CardHeader, CardTitle } from "@fuutu/ui";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { openAboutWindow } from "@/lib/windows";

export default function HomePage() {
	const t = useTranslations("desktop.shell");
	return (
		<main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
			<Card>
				<CardHeader>
					<CardTitle>{t("home.title")}</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<p className="text-muted-foreground">{t("home.description")}</p>
					<div className="flex gap-2">
						<Button asChild>
							<Link href="/settings/">{t("nav.settings")}</Link>
						</Button>
						<Button variant="outline" onClick={() => void openAboutWindow()}>
							{t("home.openSecondWindow")}
						</Button>
					</div>
				</CardContent>
			</Card>
		</main>
	);
}
