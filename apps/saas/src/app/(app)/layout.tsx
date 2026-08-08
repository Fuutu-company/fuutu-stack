import { DashboardLayout } from "@app/layouts/dashboard-layout";
import { Providers } from "@shared/providers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { PropsWithChildren } from "react";
import { requireOnboarded } from "@/lib/auth-server";

export default async function AppLayout({ children }: PropsWithChildren) {
	// CRITICAL: Validate session with DB check + onboarding gate.
	// `requireOnboarded` redirects unfinished users to `/onboarding`
	// (skipping the redirect when already on that page → no loop).
	await requireOnboarded();

	const locale = await getLocale();
	const messages = await getMessages();

	return (
		<NextIntlClientProvider locale={locale} messages={messages}>
			<Providers>
				<DashboardLayout>{children}</DashboardLayout>
			</Providers>
		</NextIntlClientProvider>
	);
}
