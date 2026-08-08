"use client";

import { ConsentProvider } from "@fuutu/analytics/consent";
import type { PropsWithChildren } from "react";
import { QueryProvider } from "./query-provider";
import { ThemeProvider } from "./theme-provider";

// SaaS root layout mounts <ConsentBanner /> + <AnalyticsScript /> — both
// rely on <ConsentProvider> via useConsent(). Mounting it here keeps the
// auth-wall analytics path consistent with the marketing app.
export function Providers({ children }: PropsWithChildren) {
	return (
		<ThemeProvider>
			<ConsentProvider>
				<QueryProvider>{children}</QueryProvider>
			</ConsentProvider>
		</ThemeProvider>
	);
}
