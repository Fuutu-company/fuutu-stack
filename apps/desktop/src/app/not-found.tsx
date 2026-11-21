"use client";

import { Button } from "@fuutu/ui";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function NotFound() {
	const t = useTranslations("desktop.shell.notFound");
	return (
		<div className="flex flex-col items-start gap-3 p-8">
			<h1 className="font-heading font-semibold text-xl">{t("title")}</h1>
			<Button asChild variant="outline">
				<Link href="/">{t("back")}</Link>
			</Button>
		</div>
	);
}
