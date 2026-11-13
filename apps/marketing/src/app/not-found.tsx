import type { Locale } from "@fuutu/i18n";
import { Button } from "@fuutu/ui";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { defaultLocale } from "@/i18n/config";
import { NotFoundView } from "@/modules/shared/components/not-found-view";
import { Providers } from "@/modules/shared/providers";

export async function generateMetadata(): Promise<Metadata> {
	const locale = (await getLocale()) as Locale;
	const t = await getTranslations({ locale, namespace: "notFound" });
	return { title: t("title"), description: t("description") };
}

export default async function RootNotFound() {
	const locale = (await getLocale()) as Locale;
	const t = await getTranslations({ locale, namespace: "notFound" });
	const homeHref = locale === defaultLocale ? "/" : `/${locale}`;

	return (
		<Providers>
			<main>
				<NotFoundView
					className="min-h-svh"
					code={t("code")}
					title={t("title")}
					description={t("description")}
					action={
						<Button size="lg" asChild>
							<a href={homeHref}>
								{t("cta")}
								<ArrowRight />
							</a>
						</Button>
					}
				/>
			</main>
		</Providers>
	);
}
