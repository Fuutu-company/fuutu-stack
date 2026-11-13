import { config } from "@fuutu/config";
import { AreaBackdrop, BrandLogo } from "@fuutu/ui";
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
			<div className="relative isolate flex min-h-svh flex-col items-center justify-center bg-background px-4 py-10 sm:p-10">
				<AreaBackdrop />
				<div className="flex w-full max-w-md flex-col gap-6">
					<a
						href="/"
						className="flex items-center gap-2.5 self-center font-extrabold font-heading text-lg tracking-heading"
					>
						<BrandLogo size="lg" className="dark:invert" />
						{config.app.name}
					</a>
					{children}
				</div>
			</div>
		</NextIntlClientProvider>
	);
}
