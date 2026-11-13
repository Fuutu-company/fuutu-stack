import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { LanguageSelectText } from "fumadocs-ui/layouts/shared/slots/language-select";
import { setRequestLocale } from "next-intl/server";
import type { PropsWithChildren } from "react";
import { appDocs } from "@/app-docs";
import { LanguageSelect } from "@/components/language-select";
import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

interface DocsLayoutProps extends PropsWithChildren {
	params: Promise<{ locale: string }>;
}

export default async function Layout({ children, params }: DocsLayoutProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const { SidebarBanner } = appDocs;

	return (
		<DocsLayout
			tree={source.getPageTree(locale)}
			{...baseOptions()}
			// `sidebar` only with an app banner, so it never replaces sidebar
			// options for the default case.
			{...(SidebarBanner
				? { sidebar: { banner: <SidebarBanner locale={locale} /> } }
				: {})}
			slots={{
				languageSelect: { root: LanguageSelect, text: LanguageSelectText },
			}}
		>
			{children}
		</DocsLayout>
	);
}
