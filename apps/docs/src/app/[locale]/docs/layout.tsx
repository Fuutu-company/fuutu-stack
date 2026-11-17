import { PrivacySettingsButton } from "@fuutu/analytics/consent";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { LanguageSelectText } from "fumadocs-ui/layouts/shared/slots/language-select";
import { setRequestLocale } from "next-intl/server";
import type { PropsWithChildren } from "react";
import { appDocs } from "@/app-docs";
import { LanguageSelect } from "@/components/language-select";
import { LegalLinks } from "@/components/legal-links";
import {
	DocsContainer,
	DocsHeader,
	docsSidebarSlot,
} from "@/components/shell/slots";
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
					<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 self-start">
						<LegalLinks locale={locale} className={PRIVACY_LINK_CLASS} />
						<PrivacySettingsButton className={PRIVACY_LINK_CLASS} />
					</div>
				),
			}}
			slots={{
				languageSelect: { root: LanguageSelect, text: LanguageSelectText },
				// Kit shell (floating sidebar card, header, grid) — app slots win.
				container: DocsContainer,
				header: DocsHeader,
				sidebar: docsSidebarSlot,
				...layoutSlots,
			}}
		>
			{children}
		</DocsLayout>
	);
}
