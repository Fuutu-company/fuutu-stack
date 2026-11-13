"use client";

import { config } from "@fuutu/config";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type PropsWithChildren, useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function ThemeProvider({ children }: PropsWithChildren) {
	// `false` while the server renders and while React hydrates server HTML, so
	// the inline no-flash script stays executable there. `true` when the tree
	// is rendered purely on the client (e.g. Next's 404 error shell): React 19
	// logs an error for executable scripts created client-side, and one that
	// is not server-rendered could never run anyway — mark it as a data block.
	const clientRendered = useSyncExternalStore(
		subscribe,
		() => true,
		() => false,
	);

	return (
		<NextThemesProvider
			attribute="class"
			defaultTheme={config.theme.defaultMode}
			enableSystem={false}
			disableTransitionOnChange
			scriptProps={clientRendered ? { type: "application/json" } : undefined}
		>
			{children}
		</NextThemesProvider>
	);
}
