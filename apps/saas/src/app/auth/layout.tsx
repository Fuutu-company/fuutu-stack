import { renderSlot } from "@app/slots";
import { PrivacySettingsButton } from "@fuutu/analytics/consent";
import { config } from "@fuutu/config";
import { AreaBackdrop, BrandLogo } from "@fuutu/ui";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { appSlots } from "@/app-slots";
import { getLegalLinks } from "@/lib/legal-links";

const FOOTER_LINK_CLASS =
	"text-muted-foreground text-xs hover:text-foreground hover:underline hover:underline-offset-4";

export default async function AuthLayout({
	children,
}: {
	children: ReactNode;
}) {
	const locale = await getLocale();
	const messages = await getMessages();
	const t = await getTranslations("legal");
	const legal = getLegalLinks(locale);

	return (
		<NextIntlClientProvider locale={locale} messages={messages}>
			<div className="relative isolate flex min-h-svh flex-col items-center justify-center bg-background px-4 py-10 sm:p-10">
				<AreaBackdrop />
				<div className="flex w-full max-w-md flex-col gap-6">
					<a
						href="/"
						className="flex items-center gap-2.5 self-center font-extrabold font-heading text-lg tracking-heading"
					>
						{renderSlot(
							appSlots.authLogo,
							{},
							<BrandLogo size="lg" className="dark:invert" />,
						)}
						{config.app.name}
					</a>
					{children}
					<div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
						{legal && (
							<>
								<a href={legal.imprint} className={FOOTER_LINK_CLASS}>
									{t("imprint")}
								</a>
								<a href={legal.privacy} className={FOOTER_LINK_CLASS}>
									{t("privacy")}
								</a>
							</>
						)}
						<PrivacySettingsButton
							className={`cursor-pointer ${FOOTER_LINK_CLASS}`}
						/>
					</div>
				</div>
			</div>
		</NextIntlClientProvider>
	);
}
