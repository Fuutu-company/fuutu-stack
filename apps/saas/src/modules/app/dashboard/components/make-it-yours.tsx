"use client";

import { config } from "@fuutu/config";
import { env } from "@fuutu/env/saas";
import { i18nConfig } from "@fuutu/i18n/config";
import {
	AREA_CLASSES,
	AREAS,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@fuutu/ui";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

const DEFAULT_DOCS_URL = "https://docs.fuutustack.com";

export function MakeItYours() {
	const t = useTranslations("dashboard");
	const locale = useLocale();
	const designEnabled = config.features.designSystem;
	const docsBase = (env.NEXT_PUBLIC_DOCS_URL ?? DEFAULT_DOCS_URL).replace(
		/\/$/,
		"",
	);
	const localePrefix = locale === i18nConfig.defaultLocale ? "" : `/${locale}`;
	const themingUrl = `${docsBase}${localePrefix}/docs/guides/theming`;

	return (
		<Card className="lg:col-span-6" data-testid="make-it-yours">
			<CardHeader>
				<CardTitle className="text-base">
					<h2>{t("yours.title")}</h2>
				</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-5">
				<p className="text-muted-foreground text-sm leading-6">
					{t.rich("yours.body", {
						code: (chunks) => (
							<code className="rounded-md bg-muted px-1.5 py-0.5 font-medium font-mono text-foreground text-xs">
								{chunks}
							</code>
						),
						design: (chunks) =>
							designEnabled ? (
								<Link
									href="/design"
									className="font-semibold text-foreground underline underline-offset-4"
								>
									{chunks}
								</Link>
							) : (
								<code className="rounded-md bg-muted px-1.5 py-0.5 font-medium font-mono text-foreground text-xs">
									{chunks}
								</code>
							),
					})}
				</p>
				<ul aria-label={t("yours.swatches")} className="grid grid-cols-2 gap-3">
					{AREAS.map((area) => (
						<li
							key={area}
							className={`flex min-w-0 flex-col gap-1 rounded-2xl px-4 py-3 ${AREA_CLASSES[area].fill} ${AREA_CLASSES[area].ink}`}
						>
							<span className="font-bold text-sm">{t(`areas.${area}`)}</span>
							<code className="whitespace-nowrap font-mono font-semibold text-[0.7rem] leading-none">
								{`--area-${area}`}
							</code>
						</li>
					))}
				</ul>
				<div className="mt-auto flex flex-wrap gap-2">
					{designEnabled ? (
						<Button asChild>
							<Link href="/design">{t("yours.openDesign")}</Link>
						</Button>
					) : null}
					<Button asChild variant="outline">
						<a href={themingUrl} target="_blank" rel="noopener noreferrer">
							{t("yours.theming")}
							<ArrowUpRight />
						</a>
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
