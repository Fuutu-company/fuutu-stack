import { PrivacySettingsButton } from "@fuutu/analytics/consent";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { LanguageSelectText } from "fumadocs-ui/layouts/shared/slots/language-select";
import { setRequestLocale } from "next-intl/server";
import type { PropsWithChildren } from "react";
import { appDocs } from "@/app-docs";
import { LanguageSelect } from "@/components/language-select";
import { baseOptions, PRIVACY_LINK_CLASS } from "@/lib/layout.shared";
import { source } from "@/lib/source";

interface DocsLayoutProps extends PropsWithChildren {
	params: Promise<{ locale: string }>;
}

export default async function Layout({ children, params }: DocsLayoutProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const { SidebarBanner, layoutSlots } = appDocs;

	return (
		<DocsLayout
			tree={source.getPageTree(locale)}
			{...baseOptions()}
			sidebar={{
				...(SidebarBanner ? { banner: <SidebarBanner locale={locale} /> } : {}),
				// Reopens the consent banner; renders nothing while it is off.
				footer: (
					<PrivacySettingsButton
						className={`mt-2 self-start ${PRIVACY_LINK_CLASS}`}
					/>
				),
			}}
			slots={{
				languageSelect: { root: LanguageSelect, text: LanguageSelectText },
				...layoutSlots,
			}}
		>
			{children}
		</DocsLayout>
	);
}
