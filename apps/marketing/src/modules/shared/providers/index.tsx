"use client";

import { ConsentProvider } from "@fuutu/analytics/consent";
import type { PropsWithChildren } from "react";
import { ThemeProvider } from "./theme-provider";

// Marketing app does not use oRPC/react-query — keep providers minimal.
export function Providers({ children }: PropsWithChildren) {
	return (
		<ThemeProvider>
			<ConsentProvider>{children}</ConsentProvider>
		</ThemeProvider>
	);
}
