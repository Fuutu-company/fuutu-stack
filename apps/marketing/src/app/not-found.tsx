import type { Locale } from "@fuutu/i18n";
import { Button } from "@fuutu/ui";
import { ArrowRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { defaultLocale } from "@/i18n/config";

export default async function RootNotFound() {
	const locale = (await getLocale()) as Locale;
	const t = await getTranslations({ locale, namespace: "notFound" });
	const homeHref = locale === defaultLocale ? "/" : `/${locale}`;

	return (
		<div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">
			<div
				aria-hidden
				className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-150 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-3xl"
				style={{
					background:
						"radial-gradient(circle, oklch(var(--primary)) 0%, transparent 70%)",
				}}
			/>

			<div className="flex flex-col items-center text-center">
				<p
					aria-hidden
					className="mb-6 select-none font-bold text-[7rem] text-muted-foreground/20 leading-none tracking-tighter sm:text-[9rem]"
				>
					{t("code")}
				</p>

				<h1 className="mb-4 max-w-md text-balance font-semibold text-2xl tracking-tight sm:text-3xl">
					{t("title")}
				</h1>
				<p className="mb-10 max-w-sm text-balance text-base text-muted-foreground leading-relaxed">
					{t("description")}
				</p>

				<Button size="lg" className="rounded-full" asChild>
					<a href={homeHref}>
						{t("cta")}
						<ArrowRight className="ml-2 size-4" />
					</a>
				</Button>
			</div>
		</div>
	);
}
