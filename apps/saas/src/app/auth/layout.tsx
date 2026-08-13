import { BrandLogo } from "@fuutu/ui";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { ReactNode } from "react";

export default async function AuthLayout({
	children,
}: {
	children: ReactNode;
}) {
	const locale = await getLocale();
	const messages = await getMessages();

	return (
		<NextIntlClientProvider locale={locale} messages={messages}>
			<div className="relative flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
				<a
					href="/"
					aria-label="Brand"
					className="absolute top-6 left-6 flex items-center gap-2 font-semibold text-lg md:top-8 md:left-8"
				>
					<BrandLogo size="2xl" className="dark:invert" />
				</a>
				<div className="w-full max-w-sm md:max-w-4xl">{children}</div>
			</div>
		</NextIntlClientProvider>
	);
}
