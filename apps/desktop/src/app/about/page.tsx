"use client";

import { config, KIT_NAME, KIT_VERSION } from "@fuutu/config";
import { useTranslations } from "next-intl";

export default function AboutPage() {
	const t = useTranslations("desktop.about");
	return (
		<main className="flex flex-col gap-2 p-6">
			<h1 className="font-heading text-xl">
				{t("title", { appName: config.app.name })}
			</h1>
			<p className="text-muted-foreground text-sm">
				{t("builtWith", { kitName: `${KIT_NAME} ${KIT_VERSION}` })}
			</p>
		</main>
	);
}
