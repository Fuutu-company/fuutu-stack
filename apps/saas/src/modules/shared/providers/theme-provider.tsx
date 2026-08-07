"use client";

import { config } from "@fuutu/config";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { PropsWithChildren } from "react";

export function ThemeProvider({ children }: PropsWithChildren) {
	return (
		<NextThemesProvider
			attribute="class"
			defaultTheme={config.theme.defaultMode}
			enableSystem={false} // intentional: config.theme.defaultMode controls the default; OS preference is not used
			disableTransitionOnChange
		>
			{children}
		</NextThemesProvider>
	);
}
